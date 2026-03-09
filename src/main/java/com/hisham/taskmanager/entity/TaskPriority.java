package com.hisham.taskmanager.entity;

public enum TaskPriority {
    HIGH,
    MEDIUM,
    LOW;

    public static TaskPriority fromString(String value) {
        if (value == null || value.isBlank())
            return LOW;
        try {
            return TaskPriority.valueOf(value.toUpperCase().trim());
        } catch (IllegalArgumentException e) {
            return LOW;
        }
    }
}
