namespace api.Models;

// Somersloop / power-shard budgets available to the solver. Whole counts; 0/0 means no amplification.
public record AmplificationOptions(int AvailableSloops, int AvailableShards);
