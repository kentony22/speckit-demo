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

@WebMvcTest(TaskController.class)
class TaskControllerTest {
    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private CosmosTaskRepository repository;

    @Test
    void listsNoTasks() throws Exception {
        when(repository.findAll()).thenReturn(List.of());
        mvc.perform(get("/api/tasks")).andExpect(status().isOk()).andExpect(content().json("[]"));
    }

    @Test
    void createsATask() throws Exception {
        when(repository.create("牛乳を買う")).thenReturn(
                new TaskDocument("id", "demo-user", "牛乳を買う", "2026-11-21T00:00:00Z", false));
        mvc.perform(post("/api/tasks").contentType(APPLICATION_JSON).content("{\"name\":\"牛乳を買う\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("id"))
                .andExpect(jsonPath("$.name").value("牛乳を買う"))
                .andExpect(jsonPath("$.createdAt").value("2026-11-21T00:00:00Z"))
                .andExpect(jsonPath("$.ownerId").doesNotExist())
                .andExpect(jsonPath("$.completed").value(false));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "{}", "{\"name\":null}", "{\"name\":\"\"}", "{\"name\":\"   \"}", "{\"name\":\"　\"}"})
    void rejectsMissingOrBlankNames(String payload) throws Exception {
        mvc.perform(post("/api/tasks").contentType(APPLICATION_JSON).content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TASK_NAME_REQUIRED"));
        verifyNoInteractions(repository);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "{}", "{\"name\":null}", "{\"name\":\"\"}", "{\"name\":\"   \"}",
            "{\"name\":\"　\"}", "{\"name\":123}"})
    void rejectsInvalidRenameWithoutWriting(String payload) throws Exception {
        mvc.perform(patch("/api/tasks/{id}/name", "id").contentType(APPLICATION_JSON).content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TASK_NAME_REQUIRED"));
        verifyNoInteractions(repository);
    }

    @Test
    void returnsMissingTaskOnRename() throws Exception {
        when(repository.updateName("missing", "変更")).thenReturn(Optional.empty());
        mvc.perform(patch("/api/tasks/{id}/name", "missing").contentType(APPLICATION_JSON)
                        .content("{\"name\":\"変更\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("TASK_NOT_FOUND"));
    }

    @Test
    void reportsFailedRename() throws Exception {
        when(repository.updateName("id", "変更")).thenThrow(mock(CosmosException.class));
        mvc.perform(patch("/api/tasks/{id}/name", "id").contentType(APPLICATION_JSON)
                        .content("{\"name\":\"変更\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("TASK_STORAGE_UNAVAILABLE"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "null", "{}", "{\"completed\":null}", "{\"completed\":\"true\"}",
            "{\"completed\":1}", "{\"completed\":[]}", "{\"completed\":{}}"})
    void rejectsNonBooleanCompletion(String payload) throws Exception {
        mvc.perform(patch("/api/tasks/{id}", "id").contentType(APPLICATION_JSON).content(payload))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(repository);
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void setsTaskCompletion(boolean completed) throws Exception {
        when(repository.updateCompletion("id", completed)).thenReturn(Optional.of(
                new TaskDocument("id", "demo-user", "牛乳を買う", "2026-11-21T00:00:00Z", completed)));
        mvc.perform(patch("/api/tasks/{id}", "id").contentType(APPLICATION_JSON)
                        .content("{\"completed\":" + completed + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("id"))
                .andExpect(jsonPath("$.name").value("牛乳を買う"))
                .andExpect(jsonPath("$.createdAt").value("2026-11-21T00:00:00Z"))
                .andExpect(jsonPath("$.completed").value(completed))
                .andExpect(jsonPath("$.ownerId").doesNotExist());
    }

    @Test
    void reportsMissingTaskOnUpdate() throws Exception {
        when(repository.updateCompletion("missing", true)).thenReturn(Optional.empty());
        mvc.perform(patch("/api/tasks/{id}", "missing").contentType(APPLICATION_JSON)
                        .content("{\"completed\":true}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("TASK_NOT_FOUND"));
    }

    @Test
    void reportsCompletionWriteFailure() throws Exception {
        when(repository.updateCompletion("id", true)).thenThrow(mock(CosmosException.class));
        mvc.perform(patch("/api/tasks/{id}", "id").contentType(APPLICATION_JSON)
                        .content("{\"completed\":true}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("TASK_STORAGE_UNAVAILABLE"));
    }

    @Test
    void reportsWriteFailure() throws Exception {
        when(repository.create("買い物")).thenThrow(mock(CosmosException.class));
        mvc.perform(post("/api/tasks").contentType(APPLICATION_JSON).content("{\"name\":\"買い物\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("TASK_STORAGE_UNAVAILABLE"));
    }

    @Test
    void reportsReadFailure() throws Exception {
        when(repository.findAll()).thenThrow(mock(CosmosException.class));
        mvc.perform(get("/api/tasks"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("TASK_STORAGE_UNAVAILABLE"));
    }
}
