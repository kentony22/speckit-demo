package com.example.todo.tasks;

import com.azure.cosmos.CosmosException;
import com.example.todo.tasks.TaskController.ErrorResponse;
import com.example.todo.tasks.TaskController.TaskResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

import java.util.List;

@RestController
@RequestMapping("/api")
class TaskListController {
    private final CosmosTaskRepository repository;

    TaskListController(CosmosTaskRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/task-lists")
    List<ListResponse> list() {
        return repository.findLists().stream().map(ListResponse::from).toList();
    }

    @PostMapping("/task-lists")
    @ResponseStatus(HttpStatus.CREATED)
    ListResponse create(@RequestBody(required = false) JsonNode request) {
        var name = request == null ? null : request.path("name").stringValue(null);
        if (name == null || name.matches("(?U)\\s*")) {
            throw new InvalidListException("TASK_LIST_NAME_REQUIRED");
        }
        return ListResponse.from(repository.createList(name));
    }

    @PatchMapping("/tasks/{id}/list")
    TaskResponse updateList(@PathVariable String id, @RequestBody(required = false) JsonNode request) {
        var value = request == null ? null : request.path("listId");
        if (value == null || (!value.isNull() && (!value.isString() || value.stringValue().isBlank()))) {
            throw new InvalidListException("TASK_LIST_ID_INVALID");
        }
        String listId = value.stringValue(null);
        if (listId != null && !repository.listExists(listId)) {
            throw new MissingListOrTaskException("TASK_LIST_NOT_FOUND");
        }
        return repository.updateList(id, listId)
                .map(TaskResponse::from)
                .orElseThrow(() -> new MissingListOrTaskException("TASK_NOT_FOUND"));
    }

    @ExceptionHandler(InvalidListException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    ErrorResponse invalidInput(InvalidListException error) {
        return new ErrorResponse(error.getMessage());
    }

    @ExceptionHandler(MissingListOrTaskException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    ErrorResponse notFound(MissingListOrTaskException error) {
        return new ErrorResponse(error.getMessage());
    }

    @ExceptionHandler(CosmosException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    ErrorResponse storageUnavailable() {
        return new ErrorResponse("TASK_STORAGE_UNAVAILABLE");
    }

    record ListResponse(String id, String name) {
        static ListResponse from(TaskListDocument item) {
            return new ListResponse(item.id(), item.name());
        }
    }

    private static final class InvalidListException extends RuntimeException {
        InvalidListException(String code) {
            super(code);
        }
    }

    private static final class MissingListOrTaskException extends RuntimeException {
        MissingListOrTaskException(String code) {
            super(code);
        }
    }
}
