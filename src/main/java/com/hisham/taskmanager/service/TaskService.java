package com.hisham.taskmanager.service;

import com.hisham.taskmanager.dto.task.TaskRequest;
import com.hisham.taskmanager.dto.task.TaskResponse;

import java.util.List;

public interface TaskService {

    List<TaskResponse> getTasks(Long userId, String status);

    TaskResponse createTask(Long userId, TaskRequest request);

    TaskResponse updateTask(Long userId, Long taskId, TaskRequest request);

    void deleteTask(Long userId, Long taskId);

    TaskResponse toggleStatus(Long userId, Long taskId);
}
