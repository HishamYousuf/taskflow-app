package com.hisham.taskmanager.entity;

public enum TaskStatus {
    PENDING,
    COMPLETED;

    /**
     * Safely parse a string to TaskStatus.
     * Returns null if the input is null, empty, or not a valid status.
     */
    public static TaskStatus fromString(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return TaskStatus.valueOf(status.toUpperCase().trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid status: '" + status + "'. Allowed values: PENDING, COMPLETED");
        }
    }
}
