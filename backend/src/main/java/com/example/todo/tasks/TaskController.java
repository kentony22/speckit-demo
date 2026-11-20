package com.example.todo.tasks;

import com.azure.cosmos.CosmosException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
class TaskController {
    private final CosmosTaskRepository repository;

    TaskController(CosmosTaskRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    List<TaskResponse> list() {
        return repository.findAll().stream().map(TaskResponse::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    TaskResponse create(@RequestBody(required = false) CreateTaskRequest request) {
        if (request == null || request.name() == null || request.name().matches("(?U)\\s*")) {
            throw new TaskNameRequiredException();
        }
        return TaskResponse.from(repository.create(request.name()));
    }

    @ExceptionHandler(TaskNameRequiredException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    ErrorResponse invalidName() {
        return new ErrorResponse("TASK_NAME_REQUIRED");
    }

    @ExceptionHandler(CosmosException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    ErrorResponse storageUnavailable() {
        return new ErrorResponse("TASK_STORAGE_UNAVAILABLE");
    }

    record CreateTaskRequest(String name) {
    }

    record TaskResponse(String id, String name, String createdAt) {
        static TaskResponse from(TaskDocument item) {
            return new TaskResponse(item.id(), item.name(), item.createdAt());
        }
    }

    record ErrorResponse(String code) {
    }

    private static final class TaskNameRequiredException extends RuntimeException {
    }
}
