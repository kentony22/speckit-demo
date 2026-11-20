package com.example.todo.tasks;

import com.azure.cosmos.CosmosContainer;
import com.azure.cosmos.models.PartitionKey;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("local")
@AutoConfigureMockMvc
class TasksCosmosIT {
    private static final String OWNER_ID = "test-" + UUID.randomUUID();

    @DynamicPropertySource
    static void testOwner(DynamicPropertyRegistry registry) {
        registry.add("todo.owner-id", () -> OWNER_ID);
    }

    @Autowired
    private MockMvc mvc;

    @Autowired
    private CosmosContainer container;

    @Test
    void persistsATaskAndReturnsItOnASeparateGet() throws Exception {
        mvc.perform(get("/api/tasks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        var created = mvc.perform(post("/api/tasks").contentType(APPLICATION_JSON)
                        .content("{\"name\":\"牛乳を買う\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("牛乳を買う"))
                .andReturn();
        var id = com.jayway.jsonpath.JsonPath.<String>read(created.getResponse().getContentAsString(), "$.id");
        try {
            var stored = container.readItem(id, new PartitionKey(OWNER_ID), TaskDocument.class).getItem();
            assertThat(stored.name()).isEqualTo("牛乳を買う");
            assertThat(stored.ownerId()).isEqualTo(OWNER_ID);
            mvc.perform(post("/api/tasks").contentType(APPLICATION_JSON).content("{\"name\":\"　\"}"))
                    .andExpect(status().isBadRequest());
            mvc.perform(get("/api/tasks"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].id").value(id))
                    .andExpect(jsonPath("$[0].name").value("牛乳を買う"));
        } finally {
            container.deleteItem(id, new PartitionKey(OWNER_ID), new com.azure.cosmos.models.CosmosItemRequestOptions());
        }
    }
}
