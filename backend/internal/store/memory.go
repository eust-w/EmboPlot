package store

import (
	"context"
	"sort"
	"sync"
	"time"

	"emboplot/backend/internal/models"
)

type MemoryStore struct {
	mu         sync.RWMutex
	users      map[string]models.User
	profiles   map[string]models.Profile
	characters map[string]models.Character
	stories    map[string]models.StorySetting
	assets     map[string]models.Asset
	rooms      map[string]models.Room
}

func NewMemoryStore() *MemoryStore {
	seed := seedSnapshot()
	store := &MemoryStore{
		users:      make(map[string]models.User),
		profiles:   make(map[string]models.Profile),
		characters: make(map[string]models.Character),
		stories:    make(map[string]models.StorySetting),
		assets:     make(map[string]models.Asset),
		rooms:      make(map[string]models.Room),
	}
	for _, item := range append(seed.Characters, seed.MarketCharacters...) {
		store.characters[item.ID] = item
	}
	for _, item := range seed.Stories {
		store.stories[item.ID] = item
	}
	for _, item := range seed.Assets {
		store.assets[item.ID] = item
	}
	for _, item := range seed.Rooms {
		store.rooms[item.ID] = item
	}
	return store
}

func (m *MemoryStore) EnsureSeed(context.Context) error {
	return nil
}

func (m *MemoryStore) CreateUser(_ context.Context, user models.User) (models.User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, existing := range m.users {
		if existing.Email == user.Email {
			return models.User{}, ErrDuplicate
		}
	}
	if user.ID == "" {
		user.ID = NewID("user")
	}
	now := time.Now().UTC()
	if user.CreatedAt.IsZero() {
		user.CreatedAt = now
	}
	if user.UpdatedAt.IsZero() {
		user.UpdatedAt = now
	}
	if user.Status == "" {
		user.Status = "active"
	}
	m.users[user.ID] = user
	workspace := newUserWorkspace(user)
	m.profiles[user.ID] = workspace.Profile
	for _, item := range workspace.Characters {
		m.characters[item.ID] = item
	}
	for _, item := range workspace.Stories {
		m.stories[item.ID] = item
	}
	for _, item := range workspace.Assets {
		m.assets[item.ID] = item
	}
	for _, item := range workspace.Rooms {
		m.rooms[item.ID] = item
	}
	return user, nil
}

func (m *MemoryStore) GetUserByEmail(_ context.Context, email string) (models.User, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, user := range m.users {
		if user.Email == email {
			return user, nil
		}
	}
	return models.User{}, ErrNotFound
}

func (m *MemoryStore) GetUserByID(_ context.Context, id string) (models.User, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	user, ok := m.users[id]
	if !ok {
		return models.User{}, ErrNotFound
	}
	return user, nil
}

func (m *MemoryStore) UpdateUser(_ context.Context, user models.User) (models.User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.users[user.ID]; !ok {
		return models.User{}, ErrNotFound
	}
	user.UpdatedAt = time.Now().UTC()
	m.users[user.ID] = user
	return user, nil
}

func (m *MemoryStore) Bootstrap(ctx context.Context, userID string) (models.Bootstrap, error) {
	characters, err := m.ListCharacters(ctx, "mine", userID)
	if err != nil {
		return models.Bootstrap{}, err
	}
	marketCharacters, err := m.ListCharacters(ctx, "market", userID)
	if err != nil {
		return models.Bootstrap{}, err
	}
	stories, err := m.ListStories(ctx, "mine", userID)
	if err != nil {
		return models.Bootstrap{}, err
	}
	marketStories, err := m.ListStories(ctx, "market", userID)
	if err != nil {
		return models.Bootstrap{}, err
	}
	assets, err := m.ListAssets(ctx, userID)
	if err != nil {
		return models.Bootstrap{}, err
	}
	rooms, err := m.ListRooms(ctx, userID)
	if err != nil {
		return models.Bootstrap{}, err
	}
	profile, err := m.GetProfile(ctx, userID)
	if err != nil {
		return models.Bootstrap{}, err
	}
	return models.Bootstrap{
		Profile:          profile,
		Characters:       characters,
		MarketCharacters: marketCharacters,
		Stories:          stories,
		MarketStories:    marketStories,
		Assets:           assets,
		Rooms:            rooms,
	}, nil
}

func (m *MemoryStore) ListCharacters(_ context.Context, scope string, userID string) ([]models.Character, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	items := make([]models.Character, 0, len(m.characters))
	for _, item := range m.characters {
		if scope == "market" && !item.IsPublic {
			continue
		}
		if scope != "market" && item.UserID != userID {
			continue
		}
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].CreatedAt.Before(items[j].CreatedAt)
	})
	return items, nil
}

func (m *MemoryStore) SaveCharacter(_ context.Context, userID string, item models.Character) (models.Character, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now().UTC()
	if item.ID == "" {
		item.ID = NewID("char")
	}
	if existing, ok := m.characters[item.ID]; ok {
		if existing.UserID != userID {
			return models.Character{}, ErrNotFound
		}
		if characterPublishedLocked(existing) {
			return models.Character{}, ErrPublishedLocked
		}
		item.CreatedAt = existing.CreatedAt
	}
	item.UserID = userID
	if item.Status == "" {
		item.Status = "idle"
	}
	if item.VoiceName == "" {
		item.VoiceName = "Kore"
	}
	if item.CreatedAt.IsZero() {
		item.CreatedAt = now
	}
	item.UpdatedAt = now
	m.characters[item.ID] = item
	return item, nil
}

func (m *MemoryStore) UpdateCharacter(_ context.Context, userID string, id string, item models.Character) (models.Character, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	existing, ok := m.characters[id]
	if !ok || existing.UserID != userID {
		return models.Character{}, ErrNotFound
	}
	if characterPublishedLocked(existing) {
		return models.Character{}, ErrPublishedLocked
	}
	item.ID = id
	item.UserID = userID
	item.CreatedAt = existing.CreatedAt
	item.IsPublic = existing.IsPublic
	item.PublishedAt = existing.PublishedAt
	item.UpdatedAt = time.Now().UTC()
	if item.Status == "" {
		item.Status = existing.Status
	}
	m.characters[id] = item
	return item, nil
}

func (m *MemoryStore) PublishCharacter(_ context.Context, userID string, id string) (models.Character, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	item, ok := m.characters[id]
	if !ok || item.UserID != userID {
		return models.Character{}, ErrNotFound
	}
	now := time.Now().UTC()
	item.IsPublic = true
	if item.PublishedAt == nil {
		item.PublishedAt = &now
	}
	item.UpdatedAt = now
	m.characters[id] = item
	return item, nil
}

func (m *MemoryStore) UnpublishCharacter(_ context.Context, userID string, id string) (models.Character, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	item, ok := m.characters[id]
	if !ok || item.UserID != userID {
		return models.Character{}, ErrNotFound
	}
	now := time.Now().UTC()
	if item.IsPublic && item.PublishedAt == nil {
		item.PublishedAt = &now
	}
	item.IsPublic = false
	item.UpdatedAt = now
	m.characters[id] = item
	return item, nil
}

func (m *MemoryStore) AcquireCharacter(_ context.Context, userID string, id string) (models.Character, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	source, ok := m.characters[id]
	if !ok || !source.IsPublic {
		return models.Character{}, ErrNotFound
	}
	user, ok := m.users[userID]
	if !ok {
		return models.Character{}, ErrNotFound
	}
	now := time.Now().UTC()
	item := source
	item.ID = NewID("char")
	item.UserID = userID
	item.Creator = user.Nickname
	item.IsPublic = false
	item.PublishedAt = nil
	item.CreatedAt = now
	item.UpdatedAt = now
	if item.Status == "" {
		item.Status = "idle"
	}
	if item.VoiceName == "" {
		item.VoiceName = "Kore"
	}
	m.characters[item.ID] = item
	return item, nil
}

func (m *MemoryStore) ListStories(_ context.Context, scope string, userID string) ([]models.StorySetting, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	items := make([]models.StorySetting, 0, len(m.stories))
	for _, item := range m.stories {
		if scope == "market" && !item.IsPublic {
			continue
		}
		if scope != "market" && item.UserID != userID {
			continue
		}
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].CreatedAt.Before(items[j].CreatedAt)
	})
	return items, nil
}

func (m *MemoryStore) SaveStory(_ context.Context, userID string, item models.StorySetting) (models.StorySetting, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now().UTC()
	if item.ID == "" {
		item.ID = NewID("story")
	}
	if existing, ok := m.stories[item.ID]; ok {
		if existing.UserID != userID {
			return models.StorySetting{}, ErrNotFound
		}
		if storyPublishedLocked(existing) {
			return models.StorySetting{}, ErrPublishedLocked
		}
		item.CreatedAt = existing.CreatedAt
	}
	item.UserID = userID
	if item.CreatedAt.IsZero() {
		item.CreatedAt = now
	}
	item.UpdatedAt = now
	m.stories[item.ID] = item
	return item, nil
}

func (m *MemoryStore) PublishStory(_ context.Context, userID string, id string) (models.StorySetting, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	item, ok := m.stories[id]
	if !ok || item.UserID != userID {
		return models.StorySetting{}, ErrNotFound
	}
	now := time.Now().UTC()
	item.IsPublic = true
	if item.PublishedAt == nil {
		item.PublishedAt = &now
	}
	item.UpdatedAt = now
	m.stories[id] = item
	return item, nil
}

func (m *MemoryStore) UnpublishStory(_ context.Context, userID string, id string) (models.StorySetting, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	item, ok := m.stories[id]
	if !ok || item.UserID != userID {
		return models.StorySetting{}, ErrNotFound
	}
	now := time.Now().UTC()
	if item.IsPublic && item.PublishedAt == nil {
		item.PublishedAt = &now
	}
	item.IsPublic = false
	item.UpdatedAt = now
	m.stories[id] = item
	return item, nil
}

func (m *MemoryStore) AcquireStory(_ context.Context, userID string, id string) (models.StorySetting, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	source, ok := m.stories[id]
	if !ok || !source.IsPublic {
		return models.StorySetting{}, ErrNotFound
	}
	user, ok := m.users[userID]
	if !ok {
		return models.StorySetting{}, ErrNotFound
	}
	now := time.Now().UTC()
	item := source
	item.ID = NewID("story")
	item.UserID = userID
	item.Creator = user.Nickname
	item.IsPublic = false
	item.PublishedAt = nil
	item.CreatedAt = now
	item.UpdatedAt = now
	m.stories[item.ID] = item
	return item, nil
}

func (m *MemoryStore) ListAssets(_ context.Context, userID string) ([]models.Asset, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	items := make([]models.Asset, 0, len(m.assets))
	for _, item := range m.assets {
		if item.UserID != userID {
			continue
		}
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].CreatedAt > items[j].CreatedAt
	})
	return items, nil
}

func (m *MemoryStore) ListRooms(_ context.Context, userID string) ([]models.Room, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	items := make([]models.Room, 0, len(m.rooms))
	for _, item := range m.rooms {
		if item.UserID != userID {
			continue
		}
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].UpdatedAt.After(items[j].UpdatedAt)
	})
	return items, nil
}

func (m *MemoryStore) GetRoom(_ context.Context, userID string, id string) (models.Room, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	item, ok := m.rooms[id]
	if !ok || item.UserID != userID {
		return models.Room{}, ErrNotFound
	}
	return item, nil
}

func (m *MemoryStore) SaveRoom(_ context.Context, userID string, item models.Room) (models.Room, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now().UTC()
	if item.ID == "" {
		item.ID = NewID("room")
	}
	item.UserID = userID
	if item.Status == "" {
		item.Status = "running"
	}
	if item.CreatedAt.IsZero() {
		item.CreatedAt = now
	}
	item.UpdatedAt = now
	m.rooms[item.ID] = item
	return item, nil
}

func (m *MemoryStore) UpdateRoom(_ context.Context, userID string, id string, item models.Room) (models.Room, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	existing, ok := m.rooms[id]
	if !ok || existing.UserID != userID {
		return models.Room{}, ErrNotFound
	}
	item.ID = id
	item.UserID = userID
	item.CreatedAt = existing.CreatedAt
	item.UpdatedAt = time.Now().UTC()
	if item.Title == "" {
		item.Title = existing.Title
	}
	if item.Status == "" {
		item.Status = existing.Status
	}
	if item.StoryID == "" {
		item.StoryID = existing.StoryID
		item.CurrentStory = existing.CurrentStory
	}
	if len(item.CharacterIDs) == 0 {
		item.CharacterIDs = existing.CharacterIDs
		item.ActiveChars = existing.ActiveChars
	}
	if len(item.ScriptTimeline) == 0 {
		item.ScriptTimeline = existing.ScriptTimeline
	}
	m.rooms[id] = item
	return item, nil
}

func (m *MemoryStore) DeleteRoom(_ context.Context, userID string, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	existing, ok := m.rooms[id]
	if !ok || existing.UserID != userID {
		return ErrNotFound
	}
	delete(m.rooms, id)
	return nil
}

func (m *MemoryStore) AppendLine(_ context.Context, userID string, roomID string, line models.ScriptLine) (models.Room, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	room, ok := m.rooms[roomID]
	if !ok || room.UserID != userID {
		return models.Room{}, ErrNotFound
	}
	if line.ID == "" {
		line.ID = NewID("line")
	}
	if line.CreatedAt == 0 {
		line.CreatedAt = time.Now().UnixMilli()
	}
	room.ScriptTimeline = append(room.ScriptTimeline, line)
	room.UpdatedAt = time.Now().UTC()
	m.rooms[roomID] = room
	return room, nil
}

func (m *MemoryStore) GetProfile(_ context.Context, userID string) (models.Profile, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	profile, ok := m.profiles[userID]
	if !ok {
		return models.Profile{}, ErrNotFound
	}
	return profile, nil
}

func (m *MemoryStore) UpdateProfile(_ context.Context, userID string, profile models.Profile) (models.Profile, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	existing, ok := m.profiles[userID]
	if !ok {
		return models.Profile{}, ErrNotFound
	}
	if profile.ID == "" {
		profile.ID = existing.ID
	}
	profile.UserID = userID
	profile.Email = existing.Email
	if profile.UID == "" {
		profile.UID = existing.UID
	}
	profile.Points = existing.Points
	profile.UpdatedAt = time.Now().UTC()
	m.profiles[userID] = profile
	if user, ok := m.users[userID]; ok {
		user.Nickname = profile.Nickname
		user.AvatarChar = profile.AvatarChar
		user.AvatarURL = profile.AvatarURL
		user.Signature = profile.Signature
		user.Tags = profile.Tags
		user.Points = profile.Points
		user.UpdatedAt = profile.UpdatedAt
		m.users[userID] = user
	}
	return profile, nil
}
