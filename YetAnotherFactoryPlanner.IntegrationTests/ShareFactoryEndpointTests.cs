using System.Net.Http.Json;
using System.Text.Json;

namespace YetAnotherFactoryPlanner.IntegrationTests;

/// <summary>
/// Integration tests covering Bug 6:
///   "Save &amp; Share" creates a new CosmosDB entry on every click with no deduplication.
///   A second POST with an identical factory configuration should return the same key as
///   the first, not a brand-new one.
///   These tests are written TDD-style: they fail against the current implementation and
///   will pass once the bug is fixed.
/// </summary>
[Collection(AppHostCollection.Name)]
public sealed class ShareFactoryEndpointTests(AppHostFixture fixture)
{
	private static readonly JsonSerializerOptions JsonOptions = new()
	{
		PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
	};

	/// <summary>
	/// Bug 6 — reproducer.
	/// Posting the same factory configuration twice must return the same share key.
	/// </summary>
	[Fact]
	public async Task PostShareFactory_SameConfigPostedTwice_ReturnsSameKey()
	{
		// Arrange
		using var client = fixture.App.CreateHttpClient("api");

		var requestBody = BuildMinimalFactoryRequest("Desc_IronIngot_C", amount: 30);

		// Act
		var firstResponse = await client.PostAsJsonAsync("/share-factory", requestBody, JsonOptions);
		var secondResponse = await client.PostAsJsonAsync("/share-factory", requestBody, JsonOptions);

		// Assert — both calls must succeed
		Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);
		Assert.Equal(HttpStatusCode.Created, secondResponse.StatusCode);

		var firstKey = await ExtractKeyAsync(firstResponse);
		var secondKey = await ExtractKeyAsync(secondResponse);

		// BUG: currently returns two different GUIDs; they should be identical
		Assert.Equal(firstKey, secondKey);
	}

	/// <summary>
	/// Smoke test — a single POST with a valid factory config is saved and returns a key.
	/// This verifies the happy path remains intact.
	/// </summary>
	[Fact]
	public async Task PostShareFactory_WithValidConfig_ReturnsCreatedWithKey()
	{
		// Arrange
		using var client = fixture.App.CreateHttpClient("api");

		var requestBody = BuildMinimalFactoryRequest("Desc_IronPlate_C", amount: 15);

		// Act
		var response = await client.PostAsJsonAsync("/share-factory", requestBody, JsonOptions);

		// Assert
		Assert.Equal(HttpStatusCode.Created, response.StatusCode);

		var key = await ExtractKeyAsync(response);
		Assert.NotNull(key);
		Assert.Equal(16, key.Length);
	}

	// ---------------------------------------------------------------------------
	// Helpers
	// ---------------------------------------------------------------------------

	private static object BuildMinimalFactoryRequest(string itemKey, decimal amount) => new
	{
		factoryConfig = new
		{
			allowedRecipes = Array.Empty<string>(),
			allowHandGatheredItems = false,
			gameVersion = "1.1",
			inputItems = Array.Empty<object>(),
			inputResources = Array.Empty<object>(),
			productionItems = new[]
			{
				new { itemKey, mode = "rate", value = amount },
			},
			weightingOptions = new { resources = 1000, power = 1, complexity = 0, buildings = 0 },
			nodesPositions = Array.Empty<object>(),
		},
	};

	private static async Task<string?> ExtractKeyAsync(HttpResponseMessage response)
	{
		var json = await response.Content.ReadFromJsonAsync<JsonElement>(JsonOptions);
		return json.GetProperty("data").GetProperty("key").GetString();
	}
}
