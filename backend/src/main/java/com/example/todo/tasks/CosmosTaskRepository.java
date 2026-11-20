package com.example.todo.tasks;

import com.azure.cosmos.CosmosContainer;
import com.azure.cosmos.models.CosmosItemRequestOptions;
import com.azure.cosmos.models.CosmosQueryRequestOptions;
import com.azure.cosmos.models.PartitionKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
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
        var item = new TaskDocument(UUID.randomUUID().toString(), ownerId, name, Instant.now().toString());
        container.createItem(item, partitionKey, new CosmosItemRequestOptions());
        return item;
    }

    List<TaskDocument> findAll() {
        var options = new CosmosQueryRequestOptions().setPartitionKey(partitionKey);
        return container.queryItems("SELECT * FROM c", options, TaskDocument.class).stream()
                .sorted(Comparator.comparing((TaskDocument task) -> Instant.parse(task.createdAt()))
                        .reversed()
                        .thenComparing(TaskDocument::id))
                .toList();
    }
}
