package com.example.todo.tasks;

public record TaskListDocument(String id, String ownerId, String kind, String name, String createdAt, String groupId) {
    static final String ID_PREFIX = "list-";
    static final String KIND = "task-list";

    public TaskListDocument(String id, String ownerId, String kind, String name, String createdAt) {
        this(id, ownerId, kind, name, createdAt, null);
    }

    static boolean isListId(String id) {
        return id.startsWith(ID_PREFIX);
    }
}
