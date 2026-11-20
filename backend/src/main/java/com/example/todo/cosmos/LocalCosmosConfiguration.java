package com.example.todo.cosmos;

import com.azure.cosmos.ConsistencyLevel;
import com.azure.cosmos.CosmosClient;
import com.azure.cosmos.CosmosClientBuilder;
import com.azure.cosmos.CosmosContainer;
import com.azure.cosmos.models.CosmosContainerProperties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.util.List;

@Configuration(proxyBeanMethods = false)
@Profile("local")
public class LocalCosmosConfiguration {
    @Bean(destroyMethod = "close")
    CosmosClient cosmosClient(@Value("${todo.cosmos.endpoint}") String endpoint,
                              @Value("${todo.cosmos.key}") String key) {
        return new CosmosClientBuilder()
                .endpoint(endpoint)
                .key(key)
                .gatewayMode()
                .consistencyLevel(ConsistencyLevel.SESSION)
                .buildClient();
    }

    @Bean
    CosmosContainer tasksContainer(CosmosClient client,
                                   @Value("${todo.cosmos.database}") String databaseName) {
        client.createDatabaseIfNotExists(databaseName);
        var database = client.getDatabase(databaseName);
        database.createContainerIfNotExists(new CosmosContainerProperties("tasks", "/ownerId"));
        var container = database.getContainer("tasks");
        var paths = container.read().getProperties().getPartitionKeyDefinition().getPaths();
        if (!paths.equals(List.of("/ownerId"))) {
            throw new IllegalStateException("The tasks container must use /ownerId as its partition key");
        }
        return container;
    }
}
