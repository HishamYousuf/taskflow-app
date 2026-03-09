package com.hisham.taskmanager.entity;

public enum TaskCategory {
    WORK,
    PERSONAL,
    HEALTH;

    public static TaskCategory fromString(String value) {
        if (value == null || value.isBlank())
            return PERSONAL;
        try {
            return TaskCategory.valueOf(value.toUpperCase().trim());
        } catch (IllegalArgumentException e) {
            return PERSONAL;
        }
    }
}
