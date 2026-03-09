package com.hisham.taskmanager.controller;

import com.hisham.taskmanager.dto.task.TaskRequest;
import com.hisham.taskmanager.dto.task.TaskResponse;
import com.hisham.taskmanager.entity.User;
import com.hisham.taskmanager.repository.UserRepository;
import com.hisham.taskmanager.service.TaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<List<TaskResponse>> getTasks(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false) String status) {

        Long userId = getUserId(userDetails);
        log.info("GET /api/tasks — user: {}, status: {}", userId, status);
        List<TaskResponse> tasks = taskService.getTasks(userId, status);
        return ResponseEntity.ok(tasks);
    }

    @PostMapping
    public ResponseEntity<TaskResponse> createTask(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody TaskRequest request) {

        Long userId = getUserId(userDetails);
        log.info("POST /api/tasks — user: {}, title: {}", userId, request.getTitle());
        TaskResponse task = taskService.createTask(userId, request);
        return new ResponseEntity<>(task, HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    public ResponseEntity<TaskResponse> updateTask(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id,
            @Valid @RequestBody TaskRequest request) {

        Long userId = getUserId(userDetails);
        log.info("PUT /api/tasks/{} — user: {}", id, userId);
        TaskResponse task = taskService.updateTask(userId, id, request);
        return ResponseEntity.ok(task);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id) {

        Long userId = getUserId(userDetails);
        log.info("DELETE /api/tasks/{} — user: {}", id, userId);
        taskService.deleteTask(userId, id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<TaskResponse> toggleStatus(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id) {

        Long userId = getUserId(userDetails);
        log.info("PATCH /api/tasks/{}/status — user: {}", id, userId);
        TaskResponse task = taskService.toggleStatus(userId, id);
        return ResponseEntity.ok(task);
    }

    // ---- Helper: Extract user ID from authenticated principal ----

    private Long getUserId(UserDetails userDetails) {
        User user = userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("Authenticated user not found"));
        return user.getId();
    }
}
