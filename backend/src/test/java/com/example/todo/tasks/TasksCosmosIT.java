package com.example.todo.tasks;

import com.azure.cosmos.CosmosContainer;
import com.azure.cosmos.models.CosmosItemRequestOptions;
import com.azure.cosmos.models.PartitionKey;
import com.fasterxml.jackson.databind.node.BooleanNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
                .andExpect(jsonPath("$.completed").value(false))
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
            container.deleteItem(id, new PartitionKey(OWNER_ID), new CosmosItemRequestOptions());
        }
    }

    @Test
    void updatesALegacyTaskWithoutChangingItsOtherFields() throws Exception {
        var id = UUID.randomUUID().toString();
        var partition = new PartitionKey(OWNER_ID);
        var legacy = JsonNodeFactory.instance.objectNode()
                .put("id", id)
                .put("ownerId", OWNER_ID)
                .put("name", "以前のタスク")
                .put("createdAt", "2026-11-21T00:00:00Z")
                .put("legacyNote", "既存の追加項目");
        container.createItem(legacy, partition, new CosmosItemRequestOptions());
        try {
            assertThat(container.readItem(id, partition, legacy.getClass()).getItem().has("completed")).isFalse();
            mvc.perform(get("/api/tasks"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].id").value(id))
                    .andExpect(jsonPath("$[0].completed").value(false));

            for (boolean completed : new boolean[] {true, true, false}) {
                mvc.perform(patch("/api/tasks/{id}", id).contentType(APPLICATION_JSON)
                                .content("{\"completed\":" + completed + "}"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.id").value(id))
                        .andExpect(jsonPath("$.completed").value(completed));
                mvc.perform(get("/api/tasks"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$[0].id").value(id))
                        .andExpect(jsonPath("$[0].completed").value(completed));

                var stored = container.readItem(id, partition, legacy.getClass()).getItem();
                assertThat(stored.get("completed")).isEqualTo(BooleanNode.valueOf(completed));
                legacy.fields().forEachRemaining(field ->
                        assertThat(stored.get(field.getKey())).isEqualTo(field.getValue()));
            }
        } finally {
            container.deleteItem(id, partition, new CosmosItemRequestOptions());
        }
    }

    @Test
    void renamesOnlyTheSelectedTaskAndKeepsItsCompletion() throws Exception {
        var first = new TaskDocument(UUID.randomUUID().toString(), OWNER_ID, "元の名前", "2026-11-21T00:00:00Z", true);
        var second = new TaskDocument(UUID.randomUUID().toString(), OWNER_ID, "別のタスク", "2026-11-20T00:00:00Z", false);
        var partition = new PartitionKey(OWNER_ID);
        var options = new CosmosItemRequestOptions();
        container.createItem(first, partition, options);
        try {
            container.createItem(second, partition, options);
            try {
                mvc.perform(patch("/api/tasks/{id}/name", first.id()).contentType(APPLICATION_JSON)
                                .content("{\"name\":\"変更した名前\"}"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.id").value(first.id()))
                        .andExpect(jsonPath("$.name").value("変更した名前"))
                        .andExpect(jsonPath("$.completed").value(true));
                mvc.perform(get("/api/tasks"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.length()").value(2))
                        .andExpect(jsonPath("$[0].name").value("変更した名前"))
                        .andExpect(jsonPath("$[0].completed").value(true))
                        .andExpect(jsonPath("$[1].name").value("別のタスク"));

                var stored = container.readItem(first.id(), partition, TaskDocument.class).getItem();
                assertThat(stored).isEqualTo(new TaskDocument(first.id(), OWNER_ID, "変更した名前", first.createdAt(), true));
                assertThat(container.readItem(second.id(), partition, TaskDocument.class).getItem()).isEqualTo(second);
            } finally {
                container.deleteItem(second.id(), partition, options);
            }
        } finally {
            container.deleteItem(first.id(), partition, options);
        }
    }

    @Test
    void doesNotUpdateATaskInAnotherPartition() throws Exception {
        var id = UUID.randomUUID().toString();
        var otherOwner = OWNER_ID + "-other";
        var partition = new PartitionKey(otherOwner);
        var item = JsonNodeFactory.instance.objectNode()
                .put("id", id)
                .put("ownerId", otherOwner)
                .put("name", "別の所有者のタスク")
                .put("createdAt", "2026-11-21T00:00:00Z");
        container.createItem(item, partition, new CosmosItemRequestOptions());
        try {
            mvc.perform(patch("/api/tasks/{id}", id).contentType(APPLICATION_JSON)
                            .content("{\"completed\":true}"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("TASK_NOT_FOUND"));
            assertThat(container.readItem(id, partition, item.getClass()).getItem().has("completed")).isFalse();
        } finally {
            container.deleteItem(id, partition, new CosmosItemRequestOptions());
        }
    }
}
