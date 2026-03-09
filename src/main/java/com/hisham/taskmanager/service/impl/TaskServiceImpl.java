package com.hisham.taskmanager.service.impl;

import com.hisham.taskmanager.dto.task.TaskRequest;
import com.hisham.taskmanager.dto.task.TaskResponse;
import com.hisham.taskmanager.entity.Task;
import com.hisham.taskmanager.entity.TaskCategory;
import com.hisham.taskmanager.entity.TaskPriority;
import com.hisham.taskmanager.entity.TaskStatus;
import com.hisham.taskmanager.entity.User;
import com.hisham.taskmanager.exception.ResourceNotFoundException;
import com.hisham.taskmanager.repository.TaskRepository;
import com.hisham.taskmanager.repository.UserRepository;
import com.hisham.taskmanager.service.TaskService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TaskServiceImpl implements TaskService {

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    @Override
    public List<TaskResponse> getTasks(Long userId, String status) {
        log.info("Fetching tasks for user {} with status filter: {}", userId, status);
        List<Task> tasks;

        if (status != null && !status.isBlank()) {
            TaskStatus taskStatus = TaskStatus.fromString(status);
            tasks = taskRepository.findByUserIdAndStatus(userId, taskStatus);
        } else {
            tasks = taskRepository.findByUserId(userId);
        }

        return tasks.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public TaskResponse createTask(Long userId, TaskRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Task task = Task.builder()
                .user(user)
                .title(request.getTitle())
                .description(request.getDescription())
                .dueDate(request.getDueDate())
                .priority(TaskPriority.fromString(request.getPriority()))
                .category(TaskCategory.fromString(request.getCategory()))
                .status(TaskStatus.PENDING)
                .build();

        Task savedTask = taskRepository.save(task);
        log.info("User {} created task {}", userId, savedTask.getId());
        return mapToResponse(savedTask);
    }

    @Override
    @Transactional
    public TaskResponse updateTask(Long userId, Long taskId, TaskRequest request) {
        Task task = taskRepository.findByIdAndUserId(taskId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found with id: " + taskId));

        task.setTitle(request.getTitle());
        task.setDescription(request.getDescription());
        task.setDueDate(request.getDueDate());
        task.setPriority(TaskPriority.fromString(request.getPriority()));
        task.setCategory(TaskCategory.fromString(request.getCategory()));

        Task updatedTask = taskRepository.save(task);
        log.info("User {} updated task {}", userId, taskId);
        return mapToResponse(updatedTask);
    }

    @Override
    @Transactional
    public void deleteTask(Long userId, Long taskId) {
        Task task = taskRepository.findByIdAndUserId(taskId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found with id: " + taskId));

        taskRepository.delete(task);
        log.info("User {} deleted task {}", userId, taskId);
    }

    @Override
    @Transactional
    public TaskResponse toggleStatus(Long userId, Long taskId) {
        Task task = taskRepository.findByIdAndUserId(taskId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found with id: " + taskId));

        task.setStatus(
                task.getStatus() == TaskStatus.PENDING ? TaskStatus.COMPLETED : TaskStatus.PENDING);

        Task updatedTask = taskRepository.save(task);
        log.info("User {} toggled task {} status to {}", userId, taskId, updatedTask.getStatus());
        return mapToResponse(updatedTask);
    }

    private TaskResponse mapToResponse(Task task) {
        return TaskResponse.builder()
                .id(task.getId())
                .title(task.getTitle())
                .description(task.getDescription())
                .dueDate(task.getDueDate())
                .status(task.getStatus().name())
                .priority(task.getPriority().name())
                .category(task.getCategory().name())
                .createdAt(task.getCreatedAt())
                .build();
    }
}
