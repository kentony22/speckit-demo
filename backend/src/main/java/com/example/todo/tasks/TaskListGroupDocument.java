package com.example.todo.tasks;

public record TaskListGroupDocument(String id, String ownerId, String kind, String name, String createdAt) {
    static final String ID_PREFIX = "group-";
    static final String KIND = "list-group";

    static boolean isGroupId(String id) {
        return id.startsWith(ID_PREFIX);
    }
}
