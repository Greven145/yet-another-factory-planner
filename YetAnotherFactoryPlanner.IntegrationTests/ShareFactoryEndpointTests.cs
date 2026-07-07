using System.Net.Http.Json;
using System.Text.Json;

namespace YetAnotherFactoryPlanner.IntegrationTests;

/// <summary>
/// Integration tests covering Bug 6 (fixed):
///   "Save &amp; Share" was creating a new CosmosDB entry on every click with no deduplication.
///   A second POST with an identical factory configuration should return the same key as
///   the first, not a brand-new one.
///   Bug is fixed in the api.functions managed-functions API via content-hashed IDs
///   (FactoryClient.FindOrSaveAsync) — these tests exercise it through the AppHost.
///
/// Routes are the SWA managed-functions shape: POST /api/share-factory (201 { data: { key } }) and
/// GET /api/shared-factories/{key} (200 { data: { factory_config } } / 404). The AppHost's "api"
/// resource is the Functions host, whose HTTP triggers sit under the default /api route prefix.
/// </summary>
[Collection(AppHostCollection.Name)]
public sealed class ShareFactoryEndpointTests(AppHostFixture fixture)
{
	private static readonly JsonSerializerOptions JsonOptions = new()
	{
		PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
	};

	/// <summary>
	/// Bug 6 (fixed) — verifier.
	/// Posting the same factory configuration twice must return the same share key.
	/// api.functions uses content-hashed IDs via FindOrSaveAsync so duplicates are deduplicated.
	/// </summary>
	[Fact]
	public async Task PostShareFactory_SameConfigPostedTwice_ReturnsSameKey()
	{
		// Arrange
		using var client = fixture.App.CreateHttpClient("api");

		var requestBody = BuildMinimalFactoryRequest("Desc_IronIngot_C", amount: 30);

		// Act
		var firstResponse = await client.PostAsJsonAsync("/api/share-factory", requestBody, JsonOptions, TestContext.Current.CancellationToken);
		var secondResponse = await client.PostAsJsonAsync("/api/share-factory", requestBody, JsonOptions, TestContext.Current.CancellationToken);

		// Assert — both calls must succeed
		Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);
		Assert.Equal(HttpStatusCode.Created, secondResponse.StatusCode);

		var firstKey = await ExtractKeyAsync(firstResponse);
		var secondKey = await ExtractKeyAsync(secondResponse);

		// FIXED: api.functions returns the same content-hashed key for identical configurations.
		// Previously returned two different GUIDs.
		Assert.Equal(firstKey, secondKey);
	}

	/// <summary>
	/// Regression guard — the 1.2 Game Mode cost multipliers must be part of the factory's
	/// identity. Two configs that are identical except for <c>gameModeOptions</c> must hash to
	/// DIFFERENT keys; otherwise FindOrSaveAsync dedupes the second save away and the changed
	/// multipliers are silently lost (the "changing the multiplier doesn't save" bug).
	/// </summary>
	[Fact]
	public async Task PostShareFactory_ConfigsDifferingOnlyByGameModeOptions_ReturnDifferentKeys()
	{
		// Arrange
		using var client = fixture.App.CreateHttpClient("api");

		var defaultMultipliers = BuildMinimalFactoryRequest("Desc_IronPlate_C", amount: 10, gameVersion: "1.2");
		var scaledMultipliers = BuildMinimalFactoryRequest("Desc_IronPlate_C", amount: 10, gameVersion: "1.2",
			recipePartsCost: 2, powerConsumption: 2);

		// Act
		var defaultResponse = await client.PostAsJsonAsync("/api/share-factory", defaultMultipliers, JsonOptions, TestContext.Current.CancellationToken);
		var scaledResponse = await client.PostAsJsonAsync("/api/share-factory", scaledMultipliers, JsonOptions, TestContext.Current.CancellationToken);

		// Assert
		Assert.Equal(HttpStatusCode.Created, defaultResponse.StatusCode);
		Assert.Equal(HttpStatusCode.Created, scaledResponse.StatusCode);

		var defaultKey = await ExtractKeyAsync(defaultResponse);
		var scaledKey = await ExtractKeyAsync(scaledResponse);

		Assert.NotEqual(defaultKey, scaledKey);
	}

	/// <summary>
	/// The saved <c>gameModeOptions</c> must round-trip: after sharing a factory with non-default
	/// multipliers, fetching it back returns the same values (so the link loads as configured).
	/// </summary>
	[Fact]
	public async Task PostShareFactory_PersistsGameModeOptions_RoundTrips()
	{
		// Arrange
		using var client = fixture.App.CreateHttpClient("api");
		var requestBody = BuildMinimalFactoryRequest("Desc_IronPlate_C", amount: 10, gameVersion: "1.2",
			recipePartsCost: 0.5m, powerConsumption: 2);

		// Act — save, then fetch back
		var postResponse = await client.PostAsJsonAsync("/api/share-factory", requestBody, JsonOptions, TestContext.Current.CancellationToken);
		Assert.Equal(HttpStatusCode.Created, postResponse.StatusCode);
		var key = await ExtractKeyAsync(postResponse);

		var getResponse = await client.GetAsync($"/api/shared-factories/{key}", TestContext.Current.CancellationToken);
		Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

		// Assert — the multipliers persisted exactly as sent
		var json = await getResponse.Content.ReadFromJsonAsync<JsonElement>(JsonOptions, TestContext.Current.CancellationToken);
		var gameModeOptions = json.GetProperty("data").GetProperty("factory_config").GetProperty("gameModeOptions");
		Assert.Equal(0.5m, gameModeOptions.GetProperty("recipePartsCost").GetDecimal());
		Assert.Equal(2m, gameModeOptions.GetProperty("powerConsumption").GetDecimal());
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
		var response = await client.PostAsJsonAsync("/api/share-factory", requestBody, JsonOptions, TestContext.Current.CancellationToken);

		// Assert
		Assert.Equal(HttpStatusCode.Created, response.StatusCode);

		var key = await ExtractKeyAsync(response);
		Assert.NotNull(key);
		Assert.Equal(16, key.Length);
	}

	/// <summary>
	/// A well-formed key that was never saved must resolve to 404 Not Found (not 400/500). Preserves
	/// the coverage from the retired InitializeEndpointTests against the new share-load route.
	/// </summary>
	[Fact]
	public async Task GetSharedFactory_NonExistentKey_ReturnsNotFound()
	{
		// Arrange
		using var client = fixture.App.CreateHttpClient("api");

		// 16 lowercase hex chars — valid content-hash format, but this key was never created.
		const string nonExistentKey = "aaaaaaaaaaaaaaaa";

		// Act
		var response = await client.GetAsync($"/api/shared-factories/{nonExistentKey}", TestContext.Current.CancellationToken);

		// Assert
		Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
	}

	// ---------------------------------------------------------------------------
	// Helpers
	// ---------------------------------------------------------------------------

	private static object BuildMinimalFactoryRequest(
		string itemKey,
		decimal amount,
		decimal recipePartsCost = 1,
		decimal powerConsumption = 1,
		string gameVersion = "1.1") => new
	{
		factoryConfig = new
		{
			allowedRecipes = Array.Empty<string>(),
			allowHandGatheredItems = false,
			gameVersion,
			inputItems = Array.Empty<object>(),
			inputResources = Array.Empty<object>(),
			productionItems = new[]
			{
				new { itemKey, mode = "rate", value = amount },
			},
			weightingOptions = new { resources = 1000, power = 1, complexity = 0, buildings = 0 },
			gameModeOptions = new { recipePartsCost, powerConsumption },
			nodesPositions = Array.Empty<object>(),
		},
	};

	private static async Task<string?> ExtractKeyAsync(HttpResponseMessage response)
	{
		var json = await response.Content.ReadFromJsonAsync<JsonElement>(JsonOptions);
		return json.GetProperty("data").GetProperty("key").GetString();
	}
}
