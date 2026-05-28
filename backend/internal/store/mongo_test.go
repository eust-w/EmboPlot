package store

import (
	"testing"
	"time"
)

func TestVisibilityUpdateSetIncludesFalsePublicState(t *testing.T) {
	updatedAt := time.Unix(100, 0).UTC()
	set := visibilityUpdateSet(false, nil, updatedAt)

	value, ok := set["isPublic"]
	if !ok {
		t.Fatal("expected Mongo visibility update to include isPublic=false")
	}
	if value != false {
		t.Fatalf("expected isPublic=false, got %#v", value)
	}
	if set["updatedAt"] != updatedAt {
		t.Fatalf("expected updatedAt to be preserved, got %#v", set["updatedAt"])
	}
}
