package store

import "emboplot/backend/internal/models"

func characterPublishedLocked(item models.Character) bool {
	return item.IsPublic || item.PublishedAt != nil
}

func storyPublishedLocked(item models.StorySetting) bool {
	return item.IsPublic || item.PublishedAt != nil
}
