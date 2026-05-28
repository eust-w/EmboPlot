package store

import (
	"time"

	"emboplot/backend/internal/models"
)

type userWorkspace struct {
	Profile    models.Profile
	Characters []models.Character
	Stories    []models.StorySetting
	Assets     []models.Asset
	Rooms      []models.Room
}

func newUserWorkspace(user models.User) userWorkspace {
	now := time.Now().UTC()
	seed := seedSnapshot()

	charIDMap := make(map[string]string, len(seed.Characters))
	characters := make([]models.Character, 0, len(seed.Characters))
	for _, item := range seed.Characters {
		oldID := item.ID
		item.ID = NewID("char")
		item.UserID = user.ID
		item.Creator = user.Nickname
		item.IsPublic = false
		item.PublishedAt = nil
		item.CreatedAt = now
		item.UpdatedAt = now
		charIDMap[oldID] = item.ID
		characters = append(characters, item)
	}

	storyIDMap := make(map[string]string, len(seed.Stories))
	stories := make([]models.StorySetting, 0, len(seed.Stories))
	for _, item := range seed.Stories {
		oldID := item.ID
		item.ID = NewID("story")
		item.UserID = user.ID
		item.Creator = user.Nickname
		item.IsPublic = false
		item.PublishedAt = nil
		item.CreatedAt = now
		item.UpdatedAt = now
		storyIDMap[oldID] = item.ID
		stories = append(stories, item)
	}

	assets := make([]models.Asset, 0, len(seed.Assets))
	for _, item := range seed.Assets {
		item.ID = NewID("asset")
		item.UserID = user.ID
		item.CreatedAt = now.UnixMilli()
		assets = append(assets, item)
	}

	charByID := make(map[string]models.Character, len(characters))
	for _, item := range characters {
		charByID[item.ID] = item
	}
	storyByID := make(map[string]models.StorySetting, len(stories))
	for _, item := range stories {
		storyByID[item.ID] = item
	}

	rooms := make([]models.Room, 0, len(seed.Rooms))
	for _, item := range seed.Rooms {
		item.ID = NewID("room")
		item.UserID = user.ID
		item.StoryID = storyIDMap[item.StoryID]
		item.CurrentStory = storyByID[item.StoryID]
		item.CharacterIDs = remapIDs(item.CharacterIDs, charIDMap)
		item.ActiveChars = activeCharacters(item.CharacterIDs, charByID)
		item.CreatedAt = now
		item.UpdatedAt = now
		for i := range item.ScriptTimeline {
			item.ScriptTimeline[i].ID = NewID("line")
			item.ScriptTimeline[i].CharacterID = charIDMap[item.ScriptTimeline[i].CharacterID]
			item.ScriptTimeline[i].CreatedAt = now.UnixMilli()
		}
		rooms = append(rooms, item)
	}

	return userWorkspace{
		Profile: models.Profile{
			ID:         "profile_" + user.ID,
			UserID:     user.ID,
			Email:      user.Email,
			UID:        user.UID,
			Nickname:   user.Nickname,
			AvatarChar: user.AvatarChar,
			AvatarURL:  user.AvatarURL,
			Signature:  user.Signature,
			Tags:       user.Tags,
			Points:     user.Points,
			UpdatedAt:  now,
		},
		Characters: characters,
		Stories:    stories,
		Assets:     assets,
		Rooms:      rooms,
	}
}

func remapIDs(ids []string, mapping map[string]string) []string {
	mapped := make([]string, 0, len(ids))
	for _, id := range ids {
		if value := mapping[id]; value != "" {
			mapped = append(mapped, value)
		}
	}
	return mapped
}

func activeCharacters(ids []string, byID map[string]models.Character) []models.Character {
	items := make([]models.Character, 0, len(ids))
	for _, id := range ids {
		if item, ok := byID[id]; ok {
			items = append(items, item)
		}
	}
	return items
}
