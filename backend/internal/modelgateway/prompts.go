package modelgateway

import (
	"encoding/json"
	"strings"

	"emboplot/backend/internal/models"
)

const (
	timelineContextLimit = 24
	continuityFactLimit  = 8
)

func scriptPrompt(room models.Room) string {
	type characterBrief struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Description string `json:"description"`
		Personality string `json:"personality"`
		Memory      string `json:"memory"`
	}
	briefs := make([]characterBrief, 0, len(room.ActiveChars))
	for _, char := range room.ActiveChars {
		briefs = append(briefs, characterBrief{
			ID:          char.ID,
			Name:        char.Name,
			Description: char.Description,
			Personality: char.Personality,
			Memory:      char.Memory,
		})
	}
	start := 0
	if len(room.ScriptTimeline) > timelineContextLimit {
		start = len(room.ScriptTimeline) - timelineContextLimit
	}
	recent := room.ScriptTimeline[start:]
	payload := map[string]any{
		"story":               room.CurrentStory,
		"currentStory":        room.CurrentStory,
		"contextWindowLines":  timelineContextLimit,
		"continuityFactLines": continuityFactLimit,
		"gameSettings":        room.GameSettings,
		"activeCharacters":    briefs,
		"recentTimeline":      recent,
		"mustUseContinuity":   continuityFacts(recent),
		"requiredNextType":    requiredNextType(recent),
		"contextPolicy": []string{
			"currentStory 是唯一世界观来源；不要引入未在 currentStory、activeCharacters、recentTimeline 或用户指令中出现的阵营、地点、能力体系或专有名词。",
			"recentTimeline 是当前现场状态；下一句必须继承最后一次明确出现的地点、道具、伤势、情绪、关系和物理变化。",
			"mustUseContinuity 是最近因果清单；输出前先检查下一句是否回答或推进了其中最后 1-2 个事实。",
			"如果世界观和 recentTimeline 冲突，以 recentTimeline 的已发生事实为准，再用导演旁白解释变化来源。",
		},
		"continuityRules": []string{
			"下一句必须承接 recentTimeline 的最后一个事实，不要跳戏、不要重置场景、不要突然改写前文结论。",
			"不要把另一个故事背景、角色 IP 或无关设定混入当前剧场；所有新信息都必须能从 currentStory 或已发生剧情推出。",
			"如果用户注入了重大因果，例如死亡、失踪、爆炸、身份暴露，优先用导演旁白确认场面变化，再让角色反应。",
			"角色台词必须体现各自 personality 和 memory，不要所有人说同一种语气。",
			"当 type=character 时必须明确说话对象：targetType 只能是 character/everyone/self/air；character 表示对某个角色说话，everyone 表示对大家说话，self 表示自言自语，air 表示对空气/无人回应处说话。",
			"如果上一句直接点名或质问某个角色，下一句优先让被点名者回应，或让发话者继续对同一对象说话；不要让角色关系断裂。",
			"每 2-4 句角色对白之间应穿插导演旁白或场面调度，说明环境、动作、沉默、视线、物件或节奏变化。",
			"避免重复同一个词头、口癖或省略号；除非角色设定要求，不要连续多句以同样标点开头。",
			"不要输出解释，不要输出 Markdown，只输出一个 JSON 对象。",
		},
		"outputSchema": map[string]string{
			"type":        "director 或 character",
			"characterId": "当 type=character 时必须是 activeCharacters 之一",
			"name":        "角色名或导演",
			"targetType":  "当 type=character 时必须是 character/everyone/self/air 之一；director 可为空",
			"targetId":    "targetType=character 时必须是 activeCharacters 之一，否则为空",
			"targetName":  "targetType=character 时为目标角色名；everyone=对大家，self=自言自语，air=对空气",
			"action":      "当 type=character 时给舞台动作短句；当 type=director 时可为空",
			"content":     "下一句剧本文本，中文。director 用旁白/场面调度；character 用角色台词。",
		},
	}
	data, _ := json.Marshal(payload)
	return string(data)
}

func requiredNextType(lines []models.ScriptLine) string {
	if len(lines) == 0 {
		return string(models.LogTypeDirector)
	}
	last := lines[len(lines)-1]
	if last.Type == models.LogTypeUser {
		return string(models.LogTypeDirector)
	}
	characterRun := 0
	for i := len(lines) - 1; i >= 0; i-- {
		if lines[i].Type != models.LogTypeCharacter {
			break
		}
		characterRun++
	}
	if characterRun >= 3 {
		return string(models.LogTypeDirector)
	}
	return "director 或 character"
}

func continuityFacts(lines []models.ScriptLine) []string {
	start := 0
	if len(lines) > continuityFactLimit {
		start = len(lines) - continuityFactLimit
	}
	facts := make([]string, 0, len(lines)-start)
	for _, line := range lines[start:] {
		if strings.TrimSpace(line.Content) == "" {
			continue
		}
		speaker := strings.TrimSpace(line.Name)
		if speaker == "" {
			speaker = string(line.Type)
		}
		if target := continuityTarget(line); target != "" {
			speaker += " -> " + target
		}
		facts = append(facts, speaker+": "+truncateRunes(line.Content, 90))
	}
	return facts
}

func continuityTarget(line models.ScriptLine) string {
	if line.Type != models.LogTypeCharacter {
		return ""
	}
	switch strings.TrimSpace(line.TargetType) {
	case "character":
		target := firstNonEmpty(line.TargetName, "对方")
		if strings.HasPrefix(target, "对") {
			return target
		}
		return "对 " + target
	case "everyone":
		return "对大家"
	case "self":
		return "自言自语"
	case "air":
		return "对空气"
	default:
		return ""
	}
}

func decodeModelJSON(content string, out any) error {
	trimmed := strings.TrimSpace(content)
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	return json.Unmarshal([]byte(strings.TrimSpace(trimmed)), out)
}
