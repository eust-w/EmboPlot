package store

import (
	"time"

	"emboplot/backend/internal/models"
)

func seedCharacters(now time.Time) []models.Character {
	return []models.Character{
		{
			ID:          "char_a",
			Name:        "林深",
			Avatar:      "/demo/sample-95252ac6.svg",
			Description: "顶流爱豆，外冷内热，正处于事业巅峰期。",
			Personality: "极其克制，习惯用反讽掩饰真心。回答时短句多，避免直接袒露情绪。",
			Memory:      "曾在南方小城的雨夜便利店与苏然错过一次告白。",
			Status:      "idle",
			Creator:     "站姐001",
			Category:    "现代",
			VoiceName:   "Charon",
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			ID:          "char_b",
			Name:        "苏然",
			Avatar:      "/demo/sample-67edaee9.svg",
			Description: "独立摄影师，曾与林深有过一段未果的往事。",
			Personality: "清冷从容，追求艺术的纯粹。会用镜头和光线隐喻自己的判断。",
			Memory:      "保存着林深出道前的旧底片，一直没有公开。",
			Status:      "idle",
			Creator:     "同人写手A",
			Category:    "现代",
			VoiceName:   "Kore",
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			ID:          "char_c",
			Name:        "陈经纪",
			Avatar:      "/demo/sample-29d10da6.svg",
			Description: "精明干练的王牌经纪人。",
			Personality: "利益至上，擅长公关止损。所有建议都会先计算风险。",
			Memory:      "知道林深与苏然的旧事，并担心它会成为巡演期间的舆论炸点。",
			Status:      "idle",
			IsPublic:    true,
			Creator:     "艺人经纪组",
			Category:    "现代",
			VoiceName:   "Zephyr",
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			ID:          "char_market_1",
			Name:        "月见",
			Avatar:      "/demo/sample-27b7c05c.svg",
			Description: "神秘的神社巫女，拥有感知过去的能力。",
			Personality: "话语简练，自带疏离感。经常用神谕式短句提示关键线索。",
			Memory:      "曾在旧神社的黑匣子里听见未来倒放的钟声。",
			Status:      "idle",
			IsPublic:    true,
			Creator:     "幻梦馆",
			Category:    "幻想",
			VoiceName:   "Puck",
			CreatedAt:   now,
			UpdatedAt:   now,
		},
	}
}

func seedStories(now time.Time) []models.StorySetting {
	return []models.StorySetting{
		{
			ID:          "story_1",
			Title:       "青涩的回响",
			Description: "一个关于重逢与遗憾的故事背景，设定在潮湿的南方小城，充满了怀旧与隐忍的情绪基调。",
			CoverImage:  "/demo/sample-756bbb60.svg",
			Tags:        []string{"现代", "遗憾", "治愈"},
			IsPublic:    true,
			Creator:     "南巷档案馆",
			Content:     "午夜便利店、巡演后台、旧胶片暗房构成三条互相照映的叙事线。核心冲突是公开身份与私人记忆之间的拉扯。",
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			ID:          "story_2",
			Title:       "霓虹深处",
			Description: "赛博朋克风的都市丛林，权力、金钱与底层挣扎交织。",
			CoverImage:  "/demo/sample-a1f92103.svg",
			Tags:        []string{"科幻", "硬核", "多线"},
			IsPublic:    true,
			Creator:     "赛博档案局",
			Content:     "雨夜高架、地下诊所和巨型广告屏共同构成压迫感强烈的近未来城市。",
			CreatedAt:   now,
			UpdatedAt:   now,
		},
	}
}

func seedAssets(now time.Time) []models.Asset {
	nowMS := now.UnixMilli()
	return []models.Asset{
		{
			ID:          "asset_1",
			Type:        "character",
			Title:       "少年感林深",
			URL:         "/demo/sample-1f130cf7.svg",
			Tags:        []string{"林深", "巡演", "银发"},
			Description: "2026年夏季巡演造型，适合落寞剧情。",
			CreatedAt:   nowMS - 86400000,
		},
		{
			ID:          "asset_2",
			Type:        "background",
			Title:       "冬日车窗",
			URL:         "/demo/sample-756bbb60.svg",
			Tags:        []string{"氛围", "忧郁", "雪"},
			Description: "结满冰花的汽车后座，绝佳的离别场景。",
			CreatedAt:   nowMS - 172800000,
		},
		{
			ID:          "asset_3",
			Type:        "character",
			Title:       "宿醉苏然",
			URL:         "/demo/sample-ae622a39.svg",
			Tags:        []string{"苏然", "现代", "清冷"},
			Description: "酒后的疲惫感，捕捉了最脆弱的一瞬。",
			CreatedAt:   nowMS - 500000,
		},
	}
}

func seedProfile(now time.Time) models.Profile {
	return models.Profile{
		ID:         "profile_default",
		UID:        "ID: 88591240",
		Nickname:   "平行演播者 E",
		AvatarChar: "E",
		Signature:  "用文字编织平行时空的导演。",
		Tags:       []string{"科幻迷", "赛博朋克", "叙事大师"},
		Points:     2560,
		UpdatedAt:  now,
	}
}

func seedRooms(now time.Time, stories []models.StorySetting, characters []models.Character) []models.Room {
	roomChars := characters[:2]
	return []models.Room{
		{
			ID:           "room_1",
			Title:        "便利店的宿命重逢",
			StoryID:      stories[0].ID,
			CharacterIDs: []string{roomChars[0].ID, roomChars[1].ID},
			CurrentStory: stories[0],
			ActiveChars:  roomChars,
			GameSettings: models.GameSettings{
				Mood:       "戏剧冲突",
				Pace:       "Balanced",
				Complexity: "Standard",
				Language:   "Chinese (Simplified)",
			},
			ScriptTimeline: []models.ScriptLine{
				{
					ID:        "initial_1",
					Type:      models.LogTypeDirector,
					Content:   "午夜三点，雨势突然转急。街角的便利店成了方圆一公里内唯一的亮色。",
					CreatedAt: now.UnixMilli(),
				},
				{
					ID:          "initial_2",
					Type:        models.LogTypeCharacter,
					Name:        "林深",
					TargetType:  "air",
					TargetName:  "对空气",
					Action:      "抖开雨伞上的积水",
					Content:     "还是老样子，一股快过期的便当味。",
					CharacterID: "char_a",
					CreatedAt:   now.UnixMilli(),
				},
			},
			Status:    "running",
			CreatedAt: now,
			UpdatedAt: now,
		},
		{
			ID:           "room_2",
			Title:        "巡演后台：最后的告别",
			StoryID:      stories[0].ID,
			CharacterIDs: []string{"char_a", "char_c"},
			CurrentStory: stories[0],
			ActiveChars:  []models.Character{characters[0], characters[2]},
			GameSettings: models.GameSettings{
				Mood:       "悬疑惊悚",
				Pace:       "Slow",
				Complexity: "Deep",
				Language:   "Chinese (Simplified)",
			},
			ScriptTimeline: []models.ScriptLine{
				{
					ID:        "room_2_initial",
					Type:      models.LogTypeDirector,
					Content:   "安可曲结束后，后台通道只剩下应急灯和压低的争吵声。",
					CreatedAt: now.UnixMilli(),
				},
			},
			Status:    "running",
			CreatedAt: now,
			UpdatedAt: now,
		},
	}
}

func seedSnapshot() models.Bootstrap {
	now := time.Now().UTC()
	characters := seedCharacters(now)
	stories := seedStories(now)
	return models.Bootstrap{
		Profile:          seedProfile(now),
		Characters:       characters[:3],
		MarketCharacters: filterPublicCharacters(characters),
		Stories:          stories,
		MarketStories:    filterPublicStories(stories),
		Assets:           seedAssets(now),
		Rooms:            seedRooms(now, stories, characters),
	}
}

func filterPublicCharacters(items []models.Character) []models.Character {
	filtered := make([]models.Character, 0, len(items))
	for _, item := range items {
		if item.IsPublic {
			filtered = append(filtered, item)
		}
	}
	return filtered
}

func filterPublicStories(items []models.StorySetting) []models.StorySetting {
	filtered := make([]models.StorySetting, 0, len(items))
	for _, item := range items {
		if item.IsPublic {
			filtered = append(filtered, item)
		}
	}
	return filtered
}
