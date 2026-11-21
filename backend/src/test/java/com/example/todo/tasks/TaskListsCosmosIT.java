package com.example.todo.tasks;

import com.azure.cosmos.CosmosContainer;
import com.azure.cosmos.models.CosmosItemRequestOptions;
import com.azure.cosmos.models.PartitionKey;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.List;
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
class TaskListsCosmosIT {
    private static final String OWNER_ID = "lists-it-" + UUID.randomUUID();
    private static final PartitionKey PARTITION = new PartitionKey(OWNER_ID);

    @DynamicPropertySource
    static void testOwner(DynamicPropertyRegistry registry) {
        registry.add("todo.owner-id", () -> OWNER_ID);
    }

    @Autowired
    private MockMvc mvc;

    @Autowired
    private CosmosContainer container;

    @Test
    void createsListsAndMovesALegacyTaskWithoutDuplicatingIt() throws Exception {
        var ids = new ArrayList<String>();
        var id = UUID.randomUUID().toString();
        var legacy = JsonNodeFactory.instance.objectNode()
                .put("id", id)
                .put("ownerId", OWNER_ID)
                .put("name", "以前のタスク")
                .put("createdAt", "2026-11-21T00:00:00Z")
                .put("completed", true)
                .put("legacyNote", "そのまま");
        container.createItem(legacy, PARTITION, new CosmosItemRequestOptions());
        ids.add(id);
        try {
            var shopping = createList("買い物", ids);
            var work = createList("仕事", ids);
            mvc.perform(get("/api/task-lists"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(2))
                    .andExpect(jsonPath("$[0].id").value(shopping))
                    .andExpect(jsonPath("$[1].id").value(work));

            for (String target : List.of(shopping, work)) {
                mvc.perform(patch("/api/tasks/{id}/list", id).contentType(APPLICATION_JSON)
                                .content("{\"listId\":\"" + target + "\"}"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.id").value(id))
                        .andExpect(jsonPath("$.name").value("以前のタスク"))
                        .andExpect(jsonPath("$.completed").value(true))
                        .andExpect(jsonPath("$.listId").value(target));
                mvc.perform(get("/api/tasks"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.length()").value(1))
                        .andExpect(jsonPath("$[0].listId").value(target));
                var stored = container.readItem(id, PARTITION, legacy.getClass()).getItem();
                legacy.fields().forEachRemaining(field ->
                        assertThat(stored.get(field.getKey())).isEqualTo(field.getValue()));
            }

            mvc.perform(patch("/api/tasks/{id}/list", id).contentType(APPLICATION_JSON)
                            .content("{\"listId\":null}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.listId").isEmpty());
            mvc.perform(get("/api/tasks"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].id").value(id))
                    .andExpect(jsonPath("$[0].listId").isEmpty());
            mvc.perform(patch("/api/tasks/{id}", shopping).contentType(APPLICATION_JSON)
                            .content("{\"completed\":true}"))
                    .andExpect(status().isNotFound());
        } finally {
            ids.forEach(itemId -> container.deleteItem(itemId, PARTITION, new CosmosItemRequestOptions()));
        }
    }

    @Test
    void rejectsInvalidListNamesAndUnknownDestinations() throws Exception {
        for (String body : List.of("{}", "{\"name\":null}", "{\"name\":5}", "{\"name\":\"\"}", "{\"name\":\"  \"}", "{\"name\":\"　\"}")) {
            mvc.perform(post("/api/task-lists").contentType(APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("TASK_LIST_NAME_REQUIRED"));
        }
        mvc.perform(get("/api/task-lists"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        var response = mvc.perform(post("/api/tasks").contentType(APPLICATION_JSON)
                        .content("{\"name\":\"所属を変更しないタスク\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        String id = JsonPath.read(response.getResponse().getContentAsString(), "$.id");
        try {
            mvc.perform(patch("/api/tasks/{id}/list", id).contentType(APPLICATION_JSON).content("{}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("TASK_LIST_ID_INVALID"));
            var foreignList = "list-" + UUID.randomUUID();
            var otherOwner = OWNER_ID + "-other";
            var foreignPartition = new PartitionKey(otherOwner);
            var foreignDocument = JsonNodeFactory.instance.objectNode()
                    .put("id", foreignList)
                    .put("ownerId", otherOwner)
                    .put("kind", "task-list")
                    .put("name", "別の所有者")
                    .put("createdAt", "2026-11-21T00:00:00Z");
            container.createItem(foreignDocument, foreignPartition, new CosmosItemRequestOptions());
            try {
                mvc.perform(patch("/api/tasks/{id}/list", id).contentType(APPLICATION_JSON)
                                .content("{\"listId\":\"" + foreignList + "\"}"))
                        .andExpect(status().isNotFound())
                        .andExpect(jsonPath("$.code").value("TASK_LIST_NOT_FOUND"));
            } finally {
                container.deleteItem(foreignList, foreignPartition, new CosmosItemRequestOptions());
            }
            mvc.perform(get("/api/tasks"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].listId").isEmpty());
        } finally {
            container.deleteItem(id, PARTITION, new CosmosItemRequestOptions());
        }
    }

    @Test
    void keepsAllFieldsAcrossSequentialUpdates() throws Exception {
        var ids = new ArrayList<String>();
        try {
            var work = createList("仕事", ids);
            var created = mvc.perform(post("/api/tasks").contentType(APPLICATION_JSON)
                            .content("{\"name\":\"初期タスク\"}"))
                    .andExpect(status().isCreated())
                    .andReturn();
            String id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");
            ids.add(id);

            mvc.perform(patch("/api/tasks/{id}/name", id).contentType(APPLICATION_JSON)
                            .content("{\"name\":\"更新後タスク\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value("更新後タスク"));
            mvc.perform(patch("/api/tasks/{id}/importance", id).contentType(APPLICATION_JSON)
                            .content("{\"important\":true}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value("更新後タスク"))
                    .andExpect(jsonPath("$.important").value(true));
            mvc.perform(patch("/api/tasks/{id}", id).contentType(APPLICATION_JSON)
                            .content("{\"completed\":true}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value("更新後タスク"))
                    .andExpect(jsonPath("$.important").value(true))
                    .andExpect(jsonPath("$.completed").value(true));
            mvc.perform(patch("/api/tasks/{id}/list", id).contentType(APPLICATION_JSON)
                            .content("{\"listId\":\"" + work + "\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value("更新後タスク"))
                    .andExpect(jsonPath("$.important").value(true))
                    .andExpect(jsonPath("$.completed").value(true))
                    .andExpect(jsonPath("$.listId").value(work));
            mvc.perform(get("/api/tasks"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].id").value(id))
                    .andExpect(jsonPath("$[0].name").value("更新後タスク"))
                    .andExpect(jsonPath("$[0].important").value(true))
                    .andExpect(jsonPath("$[0].completed").value(true))
                    .andExpect(jsonPath("$[0].listId").value(work));
        } finally {
            ids.forEach(itemId -> container.deleteItem(itemId, PARTITION, new CosmosItemRequestOptions()));
        }
    }

    private String createList(String name, List<String> ids) throws Exception {
        var result = mvc.perform(post("/api/task-lists").contentType(APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value(name))
                .andReturn();
        String id = JsonPath.read(result.getResponse().getContentAsString(), "$.id");
        ids.add(id);
        return id;
    }
}
