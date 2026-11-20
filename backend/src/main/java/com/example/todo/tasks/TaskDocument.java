package com.example.todo.tasks;

public record TaskDocument(String id, String ownerId, String name, String createdAt) {
}
