package com.example.todo.tasks;

public record TaskListDocument(String id, String ownerId, String kind, String name, String createdAt) {
    static final String ID_PREFIX = "list-";
    static final String KIND = "task-list";

    static boolean isListId(String id) {
        return id.startsWith(ID_PREFIX);
    }
}
