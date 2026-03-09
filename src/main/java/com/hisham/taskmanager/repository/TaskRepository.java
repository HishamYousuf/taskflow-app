package com.hisham.taskmanager.repository;

import com.hisham.taskmanager.entity.Task;
import com.hisham.taskmanager.entity.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findByUserId(Long userId);

    List<Task> findByUserIdAndStatus(Long userId, TaskStatus status);

    Optional<Task> findByIdAndUserId(Long id, Long userId);
}
