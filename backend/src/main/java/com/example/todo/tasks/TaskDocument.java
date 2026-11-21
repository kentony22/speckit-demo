package com.example.todo.tasks;

public record TaskDocument(String id, String ownerId, String name, String createdAt, Boolean completed, Boolean important) {
    public TaskDocument {
        completed = Boolean.TRUE.equals(completed);
        important = Boolean.TRUE.equals(important);
    }
}
