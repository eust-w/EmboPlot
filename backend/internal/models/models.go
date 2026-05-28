package models

import "time"

type LogType string

const (
	LogTypeDirector  LogType = "director"
	LogTypeCharacter LogType = "character"
	LogTypeUser      LogType = "user"
)

type Character struct {
	ID          string     `bson:"id" json:"id"`
	UserID      string     `bson:"userId,omitempty" json:"userId,omitempty"`
	Name        string     `bson:"name" json:"name"`
	Avatar      string     `bson:"avatar" json:"avatar"`
	Description string     `bson:"description" json:"description"`
	Personality string     `bson:"personality,omitempty" json:"personality,omitempty"`
	Memory      string     `bson:"memory,omitempty" json:"memory,omitempty"`
	Status      string     `bson:"status" json:"status"`
	IsPublic    bool       `bson:"isPublic,omitempty" json:"isPublic,omitempty"`
	Creator     string     `bson:"creator,omitempty" json:"creator,omitempty"`
	Category    string     `bson:"category,omitempty" json:"category,omitempty"`
	VoiceName   string     `bson:"voiceName,omitempty" json:"voiceName,omitempty"`
	PublishedAt *time.Time `bson:"publishedAt,omitempty" json:"publishedAt,omitempty"`
	CreatedAt   time.Time  `bson:"createdAt" json:"createdAt"`
	UpdatedAt   time.Time  `bson:"updatedAt" json:"updatedAt"`
}

type StorySetting struct {
	ID          string     `bson:"id" json:"id"`
	UserID      string     `bson:"userId,omitempty" json:"userId,omitempty"`
	Title       string     `bson:"title" json:"title"`
	Description string     `bson:"description" json:"description"`
	CoverImage  string     `bson:"coverImage" json:"coverImage"`
	Tags        []string   `bson:"tags" json:"tags"`
	IsPublic    bool       `bson:"isPublic,omitempty" json:"isPublic,omitempty"`
	Content     string     `bson:"content,omitempty" json:"content,omitempty"`
	Creator     string     `bson:"creator,omitempty" json:"creator,omitempty"`
	PublishedAt *time.Time `bson:"publishedAt,omitempty" json:"publishedAt,omitempty"`
	CreatedAt   time.Time  `bson:"createdAt" json:"createdAt"`
	UpdatedAt   time.Time  `bson:"updatedAt" json:"updatedAt"`
}

type Scene struct {
	ID          string `bson:"id" json:"id"`
	UserID      string `bson:"userId,omitempty" json:"userId,omitempty"`
	Name        string `bson:"name" json:"name"`
	URL         string `bson:"url" json:"url"`
	Description string `bson:"description" json:"description"`
	IsPublic    bool   `bson:"isPublic,omitempty" json:"isPublic,omitempty"`
}

type ScriptLine struct {
	ID          string  `bson:"id" json:"id"`
	Type        LogType `bson:"type" json:"type"`
	CharacterID string  `bson:"characterId,omitempty" json:"characterId,omitempty"`
	Name        string  `bson:"name,omitempty" json:"name,omitempty"`
	TargetType  string  `bson:"targetType,omitempty" json:"targetType,omitempty"`
	TargetID    string  `bson:"targetId,omitempty" json:"targetId,omitempty"`
	TargetName  string  `bson:"targetName,omitempty" json:"targetName,omitempty"`
	Action      string  `bson:"action,omitempty" json:"action,omitempty"`
	Content     string  `bson:"content" json:"content"`
	IsStreaming bool    `bson:"isStreaming,omitempty" json:"isStreaming,omitempty"`
	ImageURL    string  `bson:"imageUrl,omitempty" json:"imageUrl,omitempty"`
	AudioURL    string  `bson:"audioUrl,omitempty" json:"audioUrl,omitempty"`
	CreatedAt   int64   `bson:"createdAt" json:"createdAt"`
}

type GameSettings struct {
	Mood              string `bson:"mood" json:"mood"`
	Pace              string `bson:"pace" json:"pace"`
	Complexity        string `bson:"complexity" json:"complexity"`
	InitialPlot       string `bson:"initialPlot,omitempty" json:"initialPlot,omitempty"`
	Language          string `bson:"language" json:"language"`
	PlayerCharacterID string `bson:"playerCharacterId,omitempty" json:"playerCharacterId,omitempty"`
}

type Room struct {
	ID             string       `bson:"id" json:"id"`
	UserID         string       `bson:"userId,omitempty" json:"userId,omitempty"`
	Title          string       `bson:"title" json:"title"`
	StoryID        string       `bson:"storyId" json:"storyId"`
	CharacterIDs   []string     `bson:"characterIds" json:"characterIds"`
	CurrentStory   StorySetting `bson:"currentStory" json:"currentStory"`
	ActiveChars    []Character  `bson:"activeCharacters" json:"activeCharacters"`
	GameSettings   GameSettings `bson:"gameSettings" json:"gameSettings"`
	ScriptTimeline []ScriptLine `bson:"scriptTimeline" json:"scriptTimeline"`
	Status         string       `bson:"status" json:"status"`
	CreatedAt      time.Time    `bson:"createdAt" json:"createdAt"`
	UpdatedAt      time.Time    `bson:"updatedAt" json:"updatedAt"`
}

type Asset struct {
	ID          string   `bson:"id" json:"id"`
	UserID      string   `bson:"userId,omitempty" json:"userId,omitempty"`
	Type        string   `bson:"type" json:"type"`
	Title       string   `bson:"title" json:"title"`
	URL         string   `bson:"url" json:"url"`
	Tags        []string `bson:"tags" json:"tags"`
	Description string   `bson:"description,omitempty" json:"description,omitempty"`
	CreatedAt   int64    `bson:"createdAt" json:"createdAt"`
}

type Profile struct {
	ID         string    `bson:"id" json:"id"`
	UserID     string    `bson:"userId,omitempty" json:"userId,omitempty"`
	Email      string    `bson:"email,omitempty" json:"email,omitempty"`
	UID        string    `bson:"uid" json:"uid"`
	Nickname   string    `bson:"nickname" json:"nickname"`
	AvatarChar string    `bson:"avatarChar" json:"avatarChar"`
	AvatarURL  string    `bson:"avatarUrl,omitempty" json:"avatarUrl,omitempty"`
	Signature  string    `bson:"signature" json:"signature"`
	Tags       []string  `bson:"tags" json:"tags"`
	Points     int       `bson:"points" json:"points"`
	UpdatedAt  time.Time `bson:"updatedAt" json:"updatedAt"`
}

type User struct {
	ID           string    `bson:"id" json:"id"`
	Email        string    `bson:"email" json:"email"`
	PasswordHash string    `bson:"passwordHash" json:"-"`
	UID          string    `bson:"uid" json:"uid"`
	Nickname     string    `bson:"nickname" json:"nickname"`
	AvatarChar   string    `bson:"avatarChar" json:"avatarChar"`
	AvatarURL    string    `bson:"avatarUrl,omitempty" json:"avatarUrl,omitempty"`
	Signature    string    `bson:"signature" json:"signature"`
	Tags         []string  `bson:"tags" json:"tags"`
	Points       int       `bson:"points" json:"points"`
	Status       string    `bson:"status" json:"status"`
	CreatedAt    time.Time `bson:"createdAt" json:"createdAt"`
	UpdatedAt    time.Time `bson:"updatedAt" json:"updatedAt"`
	LastLoginAt  time.Time `bson:"lastLoginAt,omitempty" json:"lastLoginAt,omitempty"`
}

type PublicUser struct {
	ID          string    `json:"id"`
	Email       string    `json:"email"`
	UID         string    `json:"uid"`
	Nickname    string    `json:"nickname"`
	AvatarChar  string    `json:"avatarChar"`
	AvatarURL   string    `json:"avatarUrl,omitempty"`
	Signature   string    `json:"signature"`
	Tags        []string  `json:"tags"`
	Points      int       `json:"points"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	LastLoginAt time.Time `json:"lastLoginAt,omitempty"`
}

func (u User) Public() PublicUser {
	return PublicUser{
		ID:          u.ID,
		Email:       u.Email,
		UID:         u.UID,
		Nickname:    u.Nickname,
		AvatarChar:  u.AvatarChar,
		AvatarURL:   u.AvatarURL,
		Signature:   u.Signature,
		Tags:        u.Tags,
		Points:      u.Points,
		Status:      u.Status,
		CreatedAt:   u.CreatedAt,
		UpdatedAt:   u.UpdatedAt,
		LastLoginAt: u.LastLoginAt,
	}
}

type Bootstrap struct {
	Profile          Profile        `json:"profile"`
	Characters       []Character    `json:"characters"`
	MarketCharacters []Character    `json:"marketCharacters"`
	Stories          []StorySetting `json:"stories"`
	MarketStories    []StorySetting `json:"marketStories"`
	Assets           []Asset        `json:"assets"`
	Rooms            []Room         `json:"rooms"`
}
