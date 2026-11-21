package com.example.todo.tasks;

public record TaskDocument(String id, String ownerId, String name, String createdAt, Boolean completed, Boolean important, String listId) {
    public TaskDocument(String id, String ownerId, String name, String createdAt, Boolean completed, Boolean important) {
        this(id, ownerId, name, createdAt, completed, important, null);
    }

    public TaskDocument {
        completed = Boolean.TRUE.equals(completed);
        important = Boolean.TRUE.equals(important);
    }
}
