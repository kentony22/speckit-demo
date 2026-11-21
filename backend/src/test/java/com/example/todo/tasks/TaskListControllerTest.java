package com.example.todo.tasks;

import com.azure.cosmos.CosmosException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TaskListController.class)
class TaskListControllerTest {
    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private CosmosTaskRepository repository;

    @Test
    void listsGroups() throws Exception {
        when(repository.findListGroups()).thenReturn(List.of(
                new TaskListGroupDocument("group-1", "demo-user", TaskListGroupDocument.KIND, "プライベート", "2026-11-21T00:00:00Z")));
        mvc.perform(get("/api/list-groups"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value("group-1"))
                .andExpect(jsonPath("$[0].name").value("プライベート"))
                .andExpect(jsonPath("$[0].ownerId").doesNotExist());
    }

    @Test
    void createsAGroup() throws Exception {
        when(repository.createListGroup("キャリア")).thenReturn(
                new TaskListGroupDocument("group-2", "demo-user", TaskListGroupDocument.KIND, "キャリア", "2026-11-21T00:00:00Z"));
        mvc.perform(post("/api/list-groups").contentType(APPLICATION_JSON).content("{\"name\":\"キャリア\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("group-2"))
                .andExpect(jsonPath("$.name").value("キャリア"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "{}", "{\"name\":null}", "{\"name\":5}", "{\"name\":\"\"}", "{\"name\":\"   \"}", "{\"name\":\"　\"}"})
    void rejectsInvalidGroupNames(String payload) throws Exception {
        mvc.perform(post("/api/list-groups").contentType(APPLICATION_JSON).content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("LIST_GROUP_NAME_REQUIRED"));
        verifyNoInteractions(repository);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "{}", "{\"groupId\":\"\"}", "{\"groupId\":\"   \"}", "{\"groupId\":123}", "{\"groupId\":[]}"})
    void rejectsInvalidGroupIdOnUpdate(String payload) throws Exception {
        mvc.perform(patch("/api/task-lists/{id}/group", "list-1").contentType(APPLICATION_JSON).content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("LIST_GROUP_ID_INVALID"));
        verifyNoInteractions(repository);
    }

    @Test
    void assignsAndClearsListGroup() throws Exception {
        when(repository.groupExists("group-1")).thenReturn(true);
        when(repository.updateListGroup("list-1", "group-1")).thenReturn(Optional.of(
                new TaskListDocument("list-1", "demo-user", TaskListDocument.KIND, "買い物", "2026-11-21T00:00:00Z", "group-1")));
        mvc.perform(patch("/api/task-lists/{id}/group", "list-1").contentType(APPLICATION_JSON)
                        .content("{\"groupId\":\"group-1\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("list-1"))
                .andExpect(jsonPath("$.name").value("買い物"))
                .andExpect(jsonPath("$.groupId").value("group-1"));

        when(repository.updateListGroup("list-1", null)).thenReturn(Optional.of(
                new TaskListDocument("list-1", "demo-user", TaskListDocument.KIND, "買い物", "2026-11-21T00:00:00Z", null)));
        mvc.perform(patch("/api/task-lists/{id}/group", "list-1").contentType(APPLICATION_JSON)
                        .content("{\"groupId\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groupId").isEmpty());
    }

    @Test
    void reportsMissingGroupOrList() throws Exception {
        when(repository.groupExists("group-missing")).thenReturn(false);
        mvc.perform(patch("/api/task-lists/{id}/group", "list-1").contentType(APPLICATION_JSON)
                        .content("{\"groupId\":\"group-missing\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("LIST_GROUP_NOT_FOUND"));

        when(repository.groupExists("group-1")).thenReturn(true);
        when(repository.updateListGroup("list-missing", "group-1")).thenReturn(Optional.empty());
        mvc.perform(patch("/api/task-lists/{id}/group", "list-missing").contentType(APPLICATION_JSON)
                        .content("{\"groupId\":\"group-1\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("TASK_LIST_NOT_FOUND"));
    }

    @Test
    void reportsGroupStorageFailures() throws Exception {
        when(repository.findListGroups()).thenThrow(mock(CosmosException.class));
        mvc.perform(get("/api/list-groups"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("TASK_STORAGE_UNAVAILABLE"));

        when(repository.createListGroup("仕事")).thenThrow(mock(CosmosException.class));
        mvc.perform(post("/api/list-groups").contentType(APPLICATION_JSON).content("{\"name\":\"仕事\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("TASK_STORAGE_UNAVAILABLE"));

        when(repository.groupExists("group-1")).thenReturn(true);
        when(repository.updateListGroup("list-1", "group-1")).thenThrow(mock(CosmosException.class));
        mvc.perform(patch("/api/task-lists/{id}/group", "list-1").contentType(APPLICATION_JSON)
                        .content("{\"groupId\":\"group-1\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("TASK_STORAGE_UNAVAILABLE"));
    }

    @Test
    void returnsEmptyGroupList() throws Exception {
        when(repository.findListGroups()).thenReturn(List.of());
        mvc.perform(get("/api/list-groups"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    void renamesAGroup() throws Exception {
        when(repository.updateListGroupName("group-1", "仕事・キャリア")).thenReturn(Optional.of(
                new TaskListGroupDocument("group-1", "demo-user", TaskListGroupDocument.KIND, "仕事・キャリア", "2026-11-21T00:00:00Z")));
        mvc.perform(patch("/api/list-groups/{id}/name", "group-1").contentType(APPLICATION_JSON)
                        .content("{\"name\":\"仕事・キャリア\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("group-1"))
                .andExpect(jsonPath("$.name").value("仕事・キャリア"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "{}", "{\"name\":null}", "{\"name\":123}", "{\"name\":\"\"}", "{\"name\":\"   \"}", "{\"name\":\"　\"}"})
    void rejectsInvalidGroupRename(String payload) throws Exception {
        mvc.perform(patch("/api/list-groups/{id}/name", "group-1").contentType(APPLICATION_JSON).content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("LIST_GROUP_NAME_REQUIRED"));
        verifyNoInteractions(repository);
    }

    @Test
    void reportsMissingOrFailedGroupRename() throws Exception {
        when(repository.updateListGroupName("group-missing", "変更")).thenReturn(Optional.empty());
        mvc.perform(patch("/api/list-groups/{id}/name", "group-missing").contentType(APPLICATION_JSON)
                        .content("{\"name\":\"変更\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("LIST_GROUP_NOT_FOUND"));

        when(repository.updateListGroupName("group-1", "変更")).thenThrow(mock(CosmosException.class));
        mvc.perform(patch("/api/list-groups/{id}/name", "group-1").contentType(APPLICATION_JSON)
                        .content("{\"name\":\"変更\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("TASK_STORAGE_UNAVAILABLE"));
    }

    @Test
    void renamesATaskList() throws Exception {
        when(repository.updateListName("list-1", "週末の買い物")).thenReturn(Optional.of(
                new TaskListDocument("list-1", "demo-user", TaskListDocument.KIND, "週末の買い物", "2026-11-21T00:00:00Z", "group-1")));
        mvc.perform(patch("/api/task-lists/{id}/name", "list-1").contentType(APPLICATION_JSON)
                        .content("{\"name\":\"週末の買い物\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("list-1"))
                .andExpect(jsonPath("$.name").value("週末の買い物"))
                .andExpect(jsonPath("$.groupId").value("group-1"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "{}", "{\"name\":null}", "{\"name\":123}", "{\"name\":\"\"}", "{\"name\":\"   \"}", "{\"name\":\"　\"}"})
    void rejectsInvalidTaskListRename(String payload) throws Exception {
        mvc.perform(patch("/api/task-lists/{id}/name", "list-1").contentType(APPLICATION_JSON).content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TASK_LIST_NAME_REQUIRED"));
        verifyNoInteractions(repository);
    }

    @Test
    void reportsMissingOrFailedTaskListRename() throws Exception {
        when(repository.updateListName("list-missing", "変更")).thenReturn(Optional.empty());
        mvc.perform(patch("/api/task-lists/{id}/name", "list-missing").contentType(APPLICATION_JSON)
                        .content("{\"name\":\"変更\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("TASK_LIST_NOT_FOUND"));

        when(repository.updateListName("list-1", "変更")).thenThrow(mock(CosmosException.class));
        mvc.perform(patch("/api/task-lists/{id}/name", "list-1").contentType(APPLICATION_JSON)
                        .content("{\"name\":\"変更\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("TASK_STORAGE_UNAVAILABLE"));
    }
}
