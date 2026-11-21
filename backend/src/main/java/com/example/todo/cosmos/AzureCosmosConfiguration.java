package com.example.todo.cosmos;

import com.azure.cosmos.ConsistencyLevel;
import com.azure.cosmos.CosmosClient;
import com.azure.cosmos.CosmosClientBuilder;
import com.azure.cosmos.CosmosContainer;
import com.azure.identity.ManagedIdentityCredentialBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration(proxyBeanMethods = false)
@Profile("azure")
public class AzureCosmosConfiguration {
    @Bean(destroyMethod = "close")
    CosmosClient cosmosClient(@Value("${todo.cosmos.endpoint}") String endpoint) {
        return new CosmosClientBuilder()
                .endpoint(endpoint)
                .credential(new ManagedIdentityCredentialBuilder().build())
                .gatewayMode()
                .consistencyLevel(ConsistencyLevel.SESSION)
                .buildClient();
    }

    @Bean
    CosmosContainer tasksContainer(CosmosClient client,
                                   @Value("${todo.cosmos.database}") String database,
                                   @Value("${todo.cosmos.container}") String container) {
        return client.getDatabase(database).getContainer(container);
    }
}
