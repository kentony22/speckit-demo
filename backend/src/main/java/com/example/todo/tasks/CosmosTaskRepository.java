package com.example.todo.tasks;

import com.azure.cosmos.CosmosContainer;
import com.azure.cosmos.CosmosException;
import com.azure.cosmos.models.CosmosItemRequestOptions;
import com.azure.cosmos.models.CosmosPatchItemRequestOptions;
import com.azure.cosmos.models.CosmosPatchOperations;
import com.azure.cosmos.models.CosmosQueryRequestOptions;
import com.azure.cosmos.models.PartitionKey;
import com.azure.cosmos.models.SqlParameter;
import com.azure.cosmos.models.SqlQuerySpec;
import com.fasterxml.jackson.databind.node.NullNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
class CosmosTaskRepository {
    private final CosmosContainer container;
    private final String ownerId;
    private final PartitionKey partitionKey;

    CosmosTaskRepository(CosmosContainer container, @Value("${todo.owner-id}") String ownerId) {
        this.container = container;
        this.ownerId = ownerId;
        this.partitionKey = new PartitionKey(ownerId);
    }

    TaskDocument create(String name) {
        var item = new TaskDocument(UUID.randomUUID().toString(), ownerId, name, Instant.now().toString(), false, false);
        container.createItem(item, partitionKey, new CosmosItemRequestOptions());
        return item;
    }

    Optional<TaskDocument> updateCompletion(String id, boolean completed) {
        return patchTask(id, CosmosPatchOperations.create().set("/completed", completed));
    }

    Optional<TaskDocument> updateName(String id, String name) {
        return patchTask(id, CosmosPatchOperations.create().set("/name", name));
    }

    Optional<TaskDocument> updateImportance(String id, boolean important) {
        return patchTask(id, CosmosPatchOperations.create().set("/important", important));
    }

    Optional<TaskDocument> updateList(String id, String listId) {
        var operations = CosmosPatchOperations.create().set("/listId", listId == null ? NullNode.getInstance() : listId);
        return patchTask(id, operations);
    }

    boolean delete(String id) {
        if (TaskListDocument.isListId(id) || TaskListGroupDocument.isGroupId(id)) {
            return false;
        }
        try {
            container.deleteItem(id, partitionKey, new CosmosItemRequestOptions());
            return true;
        } catch (CosmosException error) {
            if (error.getStatusCode() == HttpStatus.NOT_FOUND.value()) {
                return false;
            }
            throw error;
        }
    }

    private Optional<TaskDocument> patchTask(String id, CosmosPatchOperations operations) {
        if (TaskListDocument.isListId(id) || TaskListGroupDocument.isGroupId(id)) {
            return Optional.empty();
        }
        var options = new CosmosPatchItemRequestOptions();
        options.setContentResponseOnWriteEnabled(true);
        try {
            var response = container.patchItem(id, partitionKey, operations, options, TaskDocument.class);
            return Optional.of(response.getItem());
        } catch (CosmosException error) {
            if (error.getStatusCode() == HttpStatus.NOT_FOUND.value()) {
                return Optional.empty();
            }
            throw error;
        }
    }

    List<TaskDocument> findAll() {
        var options = new CosmosQueryRequestOptions().setPartitionKey(partitionKey);
        return container.queryItems("SELECT * FROM c WHERE NOT IS_DEFINED(c.kind) OR c.kind = 'task'",
                        options, TaskDocument.class).stream()
                .sorted(Comparator.comparing((TaskDocument task) -> Instant.parse(task.createdAt()))
                        .reversed()
                        .thenComparing(TaskDocument::id))
                .toList();
    }

    TaskListDocument createList(String name) {
        var item = new TaskListDocument(TaskListDocument.ID_PREFIX + UUID.randomUUID(), ownerId,
                TaskListDocument.KIND, name, Instant.now().toString());
        container.createItem(item, partitionKey, new CosmosItemRequestOptions());
        return item;
    }

    List<TaskListDocument> findLists() {
        var options = new CosmosQueryRequestOptions().setPartitionKey(partitionKey);
        var query = new SqlQuerySpec("SELECT * FROM c WHERE c.kind = @kind",
                new SqlParameter("@kind", TaskListDocument.KIND));
        return container.queryItems(query, options, TaskListDocument.class).stream()
                .sorted(Comparator.comparing((TaskListDocument list) -> Instant.parse(list.createdAt()))
                        .thenComparing(TaskListDocument::id))
                .toList();
    }

    boolean listExists(String id) {
        if (!TaskListDocument.isListId(id)) {
            return false;
        }
        try {
            var item = container.readItem(id, partitionKey, TaskListDocument.class).getItem();
            return TaskListDocument.KIND.equals(item.kind());
        } catch (CosmosException error) {
            if (error.getStatusCode() == HttpStatus.NOT_FOUND.value()) {
                return false;
            }
            throw error;
        }
    }

    TaskListGroupDocument createListGroup(String name) {
        var item = new TaskListGroupDocument(TaskListGroupDocument.ID_PREFIX + UUID.randomUUID(), ownerId,
                TaskListGroupDocument.KIND, name, Instant.now().toString());
        container.createItem(item, partitionKey, new CosmosItemRequestOptions());
        return item;
    }

    List<TaskListGroupDocument> findListGroups() {
        var options = new CosmosQueryRequestOptions().setPartitionKey(partitionKey);
        var query = new SqlQuerySpec("SELECT * FROM c WHERE c.kind = @kind",
                new SqlParameter("@kind", TaskListGroupDocument.KIND));
        return container.queryItems(query, options, TaskListGroupDocument.class).stream()
                .sorted(Comparator.comparing((TaskListGroupDocument group) -> Instant.parse(group.createdAt()))
                        .thenComparing(TaskListGroupDocument::id))
                .toList();
    }

    boolean groupExists(String id) {
        if (!TaskListGroupDocument.isGroupId(id)) {
            return false;
        }
        try {
            var item = container.readItem(id, partitionKey, TaskListGroupDocument.class).getItem();
            return TaskListGroupDocument.KIND.equals(item.kind());
        } catch (CosmosException error) {
            if (error.getStatusCode() == HttpStatus.NOT_FOUND.value()) {
                return false;
            }
            throw error;
        }
    }

    Optional<TaskListDocument> updateListGroup(String id, String groupId) {
        if (!TaskListDocument.isListId(id)) {
            return Optional.empty();
        }
        var operations = CosmosPatchOperations.create()
                .set("/groupId", groupId == null ? NullNode.getInstance() : groupId);
        var options = new CosmosPatchItemRequestOptions();
        options.setContentResponseOnWriteEnabled(true);
        try {
            var response = container.patchItem(id, partitionKey, operations, options, TaskListDocument.class);
            return Optional.of(response.getItem());
        } catch (CosmosException error) {
            if (error.getStatusCode() == HttpStatus.NOT_FOUND.value()) {
                return Optional.empty();
            }
            throw error;
        }
    }

    Optional<TaskListGroupDocument> updateListGroupName(String id, String name) {
        if (!TaskListGroupDocument.isGroupId(id)) {
            return Optional.empty();
        }
        var operations = CosmosPatchOperations.create().set("/name", name);
        var options = new CosmosPatchItemRequestOptions();
        options.setContentResponseOnWriteEnabled(true);
        try {
            var response = container.patchItem(id, partitionKey, operations, options, TaskListGroupDocument.class);
            return Optional.of(response.getItem());
        } catch (CosmosException error) {
            if (error.getStatusCode() == HttpStatus.NOT_FOUND.value()) {
                return Optional.empty();
            }
            throw error;
        }
    }
}
