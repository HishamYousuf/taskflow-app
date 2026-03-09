package com.hisham.taskmanager.dto.task;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TaskRequest {

    @NotBlank(message = "Title is required")
    private String title;

    private String description;

    @FutureOrPresent(message = "Due date cannot be in the past")
    private LocalDate dueDate;

    // Optional — defaults to LOW in the service layer
    private String priority;

    // Optional — defaults to PERSONAL in the service layer
    private String category;
}
