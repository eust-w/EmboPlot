package api

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"strings"
	"time"

	"emboplot/backend/internal/models"
)

const (
	audioExportPauseMilliseconds = 550
	audioExportMaxInputBytes     = 32 << 20
)

type audioExportRequest struct {
	Title            string              `json:"title"`
	ScriptTimeline   []models.ScriptLine `json:"scriptTimeline"`
	ActiveCharacters []models.Character  `json:"activeCharacters"`
}

type wavFormat struct {
	audioFormat   uint16
	channels      uint16
	sampleRate    uint32
	blockAlign    uint16
	bitsPerSample uint16
}

type wavSegment struct {
	format wavFormat
	data   []byte
}

func (s *Server) handleAudioExport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var payload audioExportRequest
	if err := decodeJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	voiceByCharacterID := make(map[string]string, len(payload.ActiveCharacters))
	for _, character := range payload.ActiveCharacters {
		if strings.TrimSpace(character.ID) == "" || strings.TrimSpace(character.VoiceName) == "" {
			continue
		}
		voiceByCharacterID[character.ID] = character.VoiceName
	}

	segments := make([]wavSegment, 0, len(payload.ScriptTimeline))
	for _, line := range payload.ScriptTimeline {
		text := speechTextForExportLine(line)
		if text == "" {
			continue
		}
		audioURL := strings.TrimSpace(line.AudioURL)
		if audioURL == "" {
			result, err := s.modelGateway.GenerateSpeech(r.Context(), text, voiceForExportLine(line, voiceByCharacterID))
			if err != nil {
				writeError(w, statusFromError(err), err.Error())
				return
			}
			audioURL = result.URL
		}
		rawAudio, err := loadExportAudio(r, audioURL)
		if err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
		segment, err := parseWAV(rawAudio)
		if err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
		segments = append(segments, segment)
	}

	if len(segments) == 0 {
		writeError(w, http.StatusBadRequest, "scriptTimeline must contain at least one speakable line")
		return
	}

	audio, err := concatenateWAVSegments(segments, audioExportPauseMilliseconds)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	filename := exportAudioFilename(payload.Title)
	w.Header().Set("Content-Type", "audio/wav")
	w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": filename}))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(audio)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(audio)
}

func speechTextForExportLine(line models.ScriptLine) string {
	content := strings.TrimSpace(line.Content)
	if content == "" {
		return ""
	}
	if line.Type == models.LogTypeUser {
		return "导演指令：" + content
	}
	return content
}

func voiceForExportLine(line models.ScriptLine, voiceByCharacterID map[string]string) string {
	switch line.Type {
	case models.LogTypeDirector, models.LogTypeUser:
		return "Cherry"
	case models.LogTypeCharacter:
		if voice := strings.TrimSpace(voiceByCharacterID[line.CharacterID]); voice != "" {
			return voice
		}
	}
	return "Kore"
}

func loadExportAudio(r *http.Request, audioURL string) ([]byte, error) {
	if audioURL == "" {
		return nil, errors.New("empty audio URL")
	}
	if strings.HasPrefix(strings.ToLower(audioURL), "data:") {
		return decodeAudioDataURL(audioURL)
	}

	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, audioURL, nil)
	if err != nil {
		return nil, err
	}
	client := http.Client{Timeout: 90 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("download audio failed with status %d", resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, audioExportMaxInputBytes))
}

func decodeAudioDataURL(value string) ([]byte, error) {
	comma := strings.Index(value, ",")
	if comma < 0 {
		return nil, errors.New("invalid audio data URL")
	}
	metadata := strings.ToLower(value[:comma])
	if !strings.Contains(metadata, ";base64") {
		return nil, errors.New("audio data URL must be base64 encoded")
	}
	return base64.StdEncoding.DecodeString(value[comma+1:])
}

func parseWAV(raw []byte) (wavSegment, error) {
	if len(raw) < 12 || string(raw[:4]) != "RIFF" || string(raw[8:12]) != "WAVE" {
		return wavSegment{}, errors.New("audio export currently requires WAV TTS audio")
	}

	var format wavFormat
	var pcm []byte
	for offset := 12; offset+8 <= len(raw); {
		chunkID := string(raw[offset : offset+4])
		chunkSize := int(binary.LittleEndian.Uint32(raw[offset+4 : offset+8]))
		chunkStart := offset + 8
		chunkEnd := chunkStart + chunkSize
		if chunkSize < 0 || chunkEnd > len(raw) {
			if chunkID != "data" {
				return wavSegment{}, errors.New("invalid WAV chunk size")
			}
			chunkEnd = len(raw)
		}

		switch chunkID {
		case "fmt ":
			if chunkSize < 16 {
				return wavSegment{}, errors.New("invalid WAV fmt chunk")
			}
			format = wavFormat{
				audioFormat:   binary.LittleEndian.Uint16(raw[chunkStart : chunkStart+2]),
				channels:      binary.LittleEndian.Uint16(raw[chunkStart+2 : chunkStart+4]),
				sampleRate:    binary.LittleEndian.Uint32(raw[chunkStart+4 : chunkStart+8]),
				blockAlign:    binary.LittleEndian.Uint16(raw[chunkStart+12 : chunkStart+14]),
				bitsPerSample: binary.LittleEndian.Uint16(raw[chunkStart+14 : chunkStart+16]),
			}
		case "data":
			pcm = append([]byte(nil), raw[chunkStart:chunkEnd]...)
		}

		offset = chunkEnd
		if chunkSize%2 == 1 {
			offset++
		}
	}

	if format.audioFormat != 1 || format.channels == 0 || format.sampleRate == 0 || format.blockAlign == 0 || format.bitsPerSample == 0 {
		return wavSegment{}, errors.New("audio export supports PCM WAV audio only")
	}
	if len(pcm) == 0 {
		return wavSegment{}, errors.New("WAV audio contains no PCM data")
	}
	return wavSegment{format: format, data: pcm}, nil
}

func concatenateWAVSegments(segments []wavSegment, pauseMilliseconds int) ([]byte, error) {
	if len(segments) == 0 {
		return nil, errors.New("no audio segments to concatenate")
	}
	format := segments[0].format
	var pcm bytes.Buffer
	for index, segment := range segments {
		if segment.format != format {
			return nil, errors.New("all WAV segments must use the same audio format")
		}
		pcm.Write(segment.data)
		if index < len(segments)-1 && pauseMilliseconds > 0 {
			silenceFrames := int(format.sampleRate) * pauseMilliseconds / 1000
			pcm.Write(make([]byte, silenceFrames*int(format.blockAlign)))
		}
	}
	return renderWAV(format, pcm.Bytes())
}

func renderWAV(format wavFormat, pcm []byte) ([]byte, error) {
	if len(pcm) > int(^uint32(0)-36) {
		return nil, errors.New("combined WAV is too large")
	}

	var out bytes.Buffer
	dataSize := uint32(len(pcm))
	byteRate := format.sampleRate * uint32(format.blockAlign)
	_ = binary.Write(&out, binary.LittleEndian, []byte("RIFF"))
	_ = binary.Write(&out, binary.LittleEndian, uint32(36)+dataSize)
	_ = binary.Write(&out, binary.LittleEndian, []byte("WAVEfmt "))
	_ = binary.Write(&out, binary.LittleEndian, uint32(16))
	_ = binary.Write(&out, binary.LittleEndian, format.audioFormat)
	_ = binary.Write(&out, binary.LittleEndian, format.channels)
	_ = binary.Write(&out, binary.LittleEndian, format.sampleRate)
	_ = binary.Write(&out, binary.LittleEndian, byteRate)
	_ = binary.Write(&out, binary.LittleEndian, format.blockAlign)
	_ = binary.Write(&out, binary.LittleEndian, format.bitsPerSample)
	_ = binary.Write(&out, binary.LittleEndian, []byte("data"))
	_ = binary.Write(&out, binary.LittleEndian, dataSize)
	out.Write(pcm)
	return out.Bytes(), nil
}

func exportAudioFilename(title string) string {
	title = strings.TrimSpace(title)
	if title == "" {
		title = "script"
	}
	var builder strings.Builder
	for _, ch := range strings.ToLower(title) {
		switch {
		case ch >= 'a' && ch <= 'z':
			builder.WriteRune(ch)
		case ch >= '0' && ch <= '9':
			builder.WriteRune(ch)
		case ch == '-' || ch == '_':
			builder.WriteRune(ch)
		case ch == ' ':
			builder.WriteRune('-')
		}
		if builder.Len() >= 48 {
			break
		}
	}
	name := strings.Trim(builder.String(), "-_")
	if name == "" {
		name = "script"
	}
	return name + "-audio.wav"
}
