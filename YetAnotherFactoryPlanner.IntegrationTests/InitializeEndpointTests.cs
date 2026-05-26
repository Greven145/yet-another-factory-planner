namespace YetAnotherFactoryPlanner.IntegrationTests;

/// <summary>
/// Integration tests covering Bug 1 (fixed):
///   API was returning 400 Bad Request instead of 404 Not Found for a missing factory key.
///   The request is well-formed; the resource simply does not exist.
///   Bug is fixed in api.web — these tests now pass against the current implementation.
/// </summary>
[Collection(AppHostCollection.Name)]
public sealed class InitializeEndpointTests(AppHostFixture fixture)
{
	/// <summary>
	/// Bug 1 (fixed) — verifier.
	/// A factory key that matches the expected format (16 hex/alphanumeric chars) but has
	/// never been saved should return 404 Not Found, not 400 Bad Request.
	/// api.web now correctly returns 404 for this case.
	/// </summary>
	[Fact]
	public async Task GetInitialize_WithValidFormatNonExistentFactoryKey_ReturnsNotFound()
	{
		// Arrange
		using var client = fixture.App.CreateHttpClient("api");

		// 16 lowercase alpha chars — valid format, but this key was never created
		const string nonExistentKey = "aaaaaaaaaaaaaaaa";

		// Act
		var response = await client.GetAsync($"/initialize?factoryKey={nonExistentKey}");

		// Assert
		// FIXED: api.web now correctly returns 404 NotFound for a valid-format key that doesn't exist.
		// Previously returned 400 BadRequest with {"message":"Invalid factory id"}.
		Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
	}

	/// <summary>
	/// Smoke test — the /initialize endpoint returns game data when no factory key is supplied.
	/// This verifies the happy path is still intact.
	/// </summary>
	[Fact]
	public async Task GetInitialize_WithNoFactoryKey_ReturnsOkWithGameData()
	{
		// Arrange
		using var client = fixture.App.CreateHttpClient("api");

		// Act
		var response = await client.GetAsync("/initialize");

		// Assert
		Assert.Equal(HttpStatusCode.OK, response.StatusCode);
	}
}
