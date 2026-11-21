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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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

    @Test
    void createsGroupsAndMovesALegacyListWithoutAffectingTasks() throws Exception {
        var ids = new ArrayList<String>();
        var legacyListId = "list-" + UUID.randomUUID();
        var legacyList = JsonNodeFactory.instance.objectNode()
                .put("id", legacyListId)
                .put("ownerId", OWNER_ID)
                .put("kind", "task-list")
                .put("name", "既存リスト")
                .put("createdAt", "2026-11-21T00:00:00Z");
        container.createItem(legacyList, PARTITION, new CosmosItemRequestOptions());
        ids.add(legacyListId);
        try {
            var taskCreated = mvc.perform(post("/api/tasks").contentType(APPLICATION_JSON)
                            .content("{\"name\":\"グループ確認用タスク\"}"))
                    .andExpect(status().isCreated())
                    .andReturn();
            String taskId = JsonPath.read(taskCreated.getResponse().getContentAsString(), "$.id");
            ids.add(taskId);
            mvc.perform(patch("/api/tasks/{id}/list", taskId).contentType(APPLICATION_JSON)
                            .content("{\"listId\":\"" + legacyListId + "\"}"))
                    .andExpect(status().isOk());

            var personal = createGroup("プライベート", ids);
            var career = createGroup("キャリア", ids);
            mvc.perform(get("/api/list-groups"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(2))
                    .andExpect(jsonPath("$[0].id").value(personal))
                    .andExpect(jsonPath("$[1].id").value(career));
            mvc.perform(get("/api/task-lists"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].id").value(legacyListId))
                    .andExpect(jsonPath("$[0].groupId").isEmpty());

            for (String targetGroup : List.of(personal, career)) {
                mvc.perform(patch("/api/task-lists/{id}/group", legacyListId).contentType(APPLICATION_JSON)
                                .content("{\"groupId\":\"" + targetGroup + "\"}"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.id").value(legacyListId))
                        .andExpect(jsonPath("$.name").value("既存リスト"))
                        .andExpect(jsonPath("$.groupId").value(targetGroup));
                mvc.perform(get("/api/task-lists"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.length()").value(1))
                        .andExpect(jsonPath("$[0].groupId").value(targetGroup));
            }

            mvc.perform(patch("/api/list-groups/{id}/name", career).contentType(APPLICATION_JSON)
                            .content("{\"name\":\"仕事とキャリア\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(career))
                    .andExpect(jsonPath("$.name").value("仕事とキャリア"));
            mvc.perform(get("/api/list-groups"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[1].id").value(career))
                    .andExpect(jsonPath("$[1].name").value("仕事とキャリア"));
            mvc.perform(get("/api/task-lists"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].id").value(legacyListId))
                    .andExpect(jsonPath("$[0].groupId").value(career));

            mvc.perform(patch("/api/task-lists/{id}/group", legacyListId).contentType(APPLICATION_JSON)
                            .content("{\"groupId\":null}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.groupId").isEmpty());
            mvc.perform(get("/api/tasks"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].id").value(taskId))
                    .andExpect(jsonPath("$[0].listId").value(legacyListId));

            mvc.perform(patch("/api/tasks/{id}", personal).contentType(APPLICATION_JSON)
                            .content("{\"completed\":true}"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("TASK_NOT_FOUND"));
            mvc.perform(delete("/api/tasks/{id}", personal))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("TASK_NOT_FOUND"));
            assertThat(container.readItem(personal, PARTITION, TaskListGroupDocument.class).getItem().name())
                    .isEqualTo("プライベート");
        } finally {
            ids.forEach(itemId -> container.deleteItem(itemId, PARTITION, new CosmosItemRequestOptions()));
        }
    }

    @Test
    void rejectsInvalidGroupNamesAndForeignGroups() throws Exception {
        for (String body : List.of("{}", "{\"name\":null}", "{\"name\":5}", "{\"name\":\"\"}", "{\"name\":\"  \"}", "{\"name\":\"　\"}")) {
            mvc.perform(post("/api/list-groups").contentType(APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("LIST_GROUP_NAME_REQUIRED"));
        }
        mvc.perform(get("/api/list-groups"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        var ids = new ArrayList<String>();
        try {
            var listId = createList("対象リスト", ids);
            var taskCreated = mvc.perform(post("/api/tasks").contentType(APPLICATION_JSON)
                            .content("{\"name\":\"リストではないタスク\"}"))
                    .andExpect(status().isCreated())
                    .andReturn();
            String taskId = JsonPath.read(taskCreated.getResponse().getContentAsString(), "$.id");
            ids.add(taskId);
            var ownGroup = createGroup("自分のグループ", ids);

            var foreignGroupId = "group-" + UUID.randomUUID();
            var otherOwner = OWNER_ID + "-other";
            var foreignPartition = new PartitionKey(otherOwner);
            var foreignGroup = JsonNodeFactory.instance.objectNode()
                    .put("id", foreignGroupId)
                    .put("ownerId", otherOwner)
                    .put("kind", "list-group")
                    .put("name", "他所有者のグループ")
                    .put("createdAt", "2026-11-21T00:00:00Z");
            container.createItem(foreignGroup, foreignPartition, new CosmosItemRequestOptions());
            try {
                mvc.perform(patch("/api/task-lists/{id}/group", listId).contentType(APPLICATION_JSON)
                                .content("{\"groupId\":\"" + foreignGroupId + "\"}"))
                        .andExpect(status().isNotFound())
                        .andExpect(jsonPath("$.code").value("LIST_GROUP_NOT_FOUND"));
                mvc.perform(patch("/api/task-lists/{id}/group", taskId).contentType(APPLICATION_JSON)
                                .content("{\"groupId\":\"" + ownGroup + "\"}"))
                        .andExpect(status().isNotFound())
                        .andExpect(jsonPath("$.code").value("TASK_LIST_NOT_FOUND"));
                mvc.perform(patch("/api/list-groups/{id}/name", foreignGroupId).contentType(APPLICATION_JSON)
                                .content("{\"name\":\"不正変更\"}"))
                        .andExpect(status().isNotFound())
                        .andExpect(jsonPath("$.code").value("LIST_GROUP_NOT_FOUND"));
                mvc.perform(patch("/api/list-groups/{id}/name", listId).contentType(APPLICATION_JSON)
                                .content("{\"name\":\"リストは変更不可\"}"))
                        .andExpect(status().isNotFound())
                        .andExpect(jsonPath("$.code").value("LIST_GROUP_NOT_FOUND"));
            } finally {
                container.deleteItem(foreignGroupId, foreignPartition, new CosmosItemRequestOptions());
            }
            mvc.perform(get("/api/task-lists"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].groupId").isEmpty());
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

    private String createGroup(String name, List<String> ids) throws Exception {
        var result = mvc.perform(post("/api/list-groups").contentType(APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value(name))
                .andReturn();
        String id = JsonPath.read(result.getResponse().getContentAsString(), "$.id");
        ids.add(id);
        return id;
    }
}
