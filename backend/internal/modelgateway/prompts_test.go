package modelgateway

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"emboplot/backend/internal/models"
)

func TestRequiredNextTypeAsksForNarrationAfterUserOrLongDialogueRun(t *testing.T) {
	if got := requiredNextType([]models.ScriptLine{{Type: models.LogTypeUser, Content: "林深突然失踪"}}); got != string(models.LogTypeDirector) {
		t.Fatalf("expected director after user injected cause, got %q", got)
	}
	lines := []models.ScriptLine{
		{Type: models.LogTypeCharacter, Content: "第一句"},
		{Type: models.LogTypeCharacter, Content: "第二句"},
		{Type: models.LogTypeCharacter, Content: "第三句"},
	}
	if got := requiredNextType(lines); got != string(models.LogTypeDirector) {
		t.Fatalf("expected director after long dialogue run, got %q", got)
	}
}

func TestScriptPromptCarriesContinuityRules(t *testing.T) {
	prompt := scriptPrompt(models.Room{
		CurrentStory: models.StorySetting{Title: "青涩的回响", Description: "雨夜便利店"},
		ScriptTimeline: []models.ScriptLine{
			{Type: models.LogTypeUser, Content: "林深又死了"},
		},
	})
	for _, want := range []string{"mustUseContinuity", "requiredNextType", "导演旁白", "不要跳戏"} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("expected prompt to contain %q, got %s", want, prompt)
		}
	}
}

func TestScriptPromptRequiresDialogueTargetSchema(t *testing.T) {
	prompt := scriptPrompt(models.Room{
		CurrentStory: models.StorySetting{Title: "青涩的回响", Description: "雨夜便利店"},
		ActiveChars: []models.Character{
			{ID: "char_a", Name: "林深"},
			{ID: "char_b", Name: "苏然"},
		},
		ScriptTimeline: []models.ScriptLine{
			{Type: models.LogTypeCharacter, CharacterID: "char_a", Name: "林深", Content: "你听见了吗？"},
		},
	})
	for _, want := range []string{"targetType", "targetId", "targetName", "character/everyone/self/air", "对大家", "自言自语", "对空气"} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("expected prompt to contain %q, got %s", want, prompt)
		}
	}
}

func TestScriptPromptMarksActiveCharactersWithoutRecentPresence(t *testing.T) {
	prompt := scriptPrompt(models.Room{
		CurrentStory: models.StorySetting{Title: "青涩的回响", Description: "雨夜便利店"},
		ActiveChars: []models.Character{
			{ID: "char_a", Name: "林深"},
			{ID: "char_added", Name: "新加入者"},
		},
		ScriptTimeline: []models.ScriptLine{
			{Type: models.LogTypeCharacter, CharacterID: "char_a", Name: "林深", Content: "你听见了吗？"},
		},
	})
	var payload struct {
		SilentActiveCharacters []string `json:"silentActiveCharacters"`
	}
	if err := json.Unmarshal([]byte(prompt), &payload); err != nil {
		t.Fatalf("decode prompt payload: %v", err)
	}
	if len(payload.SilentActiveCharacters) != 1 || payload.SilentActiveCharacters[0] != "新加入者" {
		t.Fatalf("expected newly active character to be marked silent, got %+v", payload.SilentActiveCharacters)
	}
	if !strings.Contains(prompt, "silentActiveCharacters") || !strings.Contains(prompt, "让其自然回应") {
		t.Fatalf("expected prompt to instruct model to include silent active characters, got %s", prompt)
	}
}

func TestScriptPromptUsesExpandedContinuityWindowAndWorldRules(t *testing.T) {
	lines := make([]models.ScriptLine, 25)
	for i := range lines {
		lines[i] = models.ScriptLine{
			ID:      fmt.Sprintf("line_%02d", i+1),
			Type:    models.LogTypeDirector,
			Content: fmt.Sprintf("连续事实%02d", i+1),
		}
	}
	prompt := scriptPrompt(models.Room{
		CurrentStory:   models.StorySetting{Title: "木叶残火", Description: "封印崩坏后的废墟"},
		ScriptTimeline: lines,
	})

	var payload struct {
		ContextWindowLines  int                 `json:"contextWindowLines"`
		ContinuityFactLines int                 `json:"continuityFactLines"`
		RecentTimeline      []models.ScriptLine `json:"recentTimeline"`
		MustUseContinuity   []string            `json:"mustUseContinuity"`
	}
	if err := json.Unmarshal([]byte(prompt), &payload); err != nil {
		t.Fatalf("decode prompt payload: %v", err)
	}
	if payload.ContextWindowLines != 24 || len(payload.RecentTimeline) != 24 {
		t.Fatalf("expected 24 recent lines, got context=%d len=%d", payload.ContextWindowLines, len(payload.RecentTimeline))
	}
	if payload.RecentTimeline[0].Content != "连续事实02" {
		t.Fatalf("expected window to keep line 02 as first retained fact, got %+v", payload.RecentTimeline[0])
	}
	if payload.ContinuityFactLines != 8 || len(payload.MustUseContinuity) != 8 {
		t.Fatalf("expected 8 continuity facts, got context=%d len=%d", payload.ContinuityFactLines, len(payload.MustUseContinuity))
	}
	if !strings.Contains(prompt, "currentStory 是唯一世界观来源") {
		t.Fatalf("expected prompt to constrain world source, got %s", prompt)
	}
}
