package api

import (
	"encoding/binary"
	"testing"
)

func TestParseWAVAcceptsStreamingDataChunkSize(t *testing.T) {
	format := wavFormat{
		audioFormat:   1,
		channels:      1,
		sampleRate:    24000,
		blockAlign:    2,
		bitsPerSample: 16,
	}
	raw, err := renderWAV(format, make([]byte, 128))
	if err != nil {
		t.Fatalf("render wav: %v", err)
	}
	binary.LittleEndian.PutUint32(raw[40:44], 0x7fffff80)

	segment, err := parseWAV(raw)
	if err != nil {
		t.Fatalf("parse streaming wav: %v", err)
	}
	if len(segment.data) != 128 {
		t.Fatalf("expected parser to use remaining bytes as PCM data, got %d", len(segment.data))
	}
}
