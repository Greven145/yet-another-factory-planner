using Aspire.Hosting;
using Aspire.Hosting.Testing;

namespace YetAnotherFactoryPlanner.IntegrationTests;

/// <summary>
/// Shared fixture that starts the full distributed application once per test collection.
/// The CosmosDB emulator requires Docker and can take several minutes to become ready.
/// </summary>
public sealed class AppHostFixture : IAsyncLifetime
{
	private static readonly TimeSpan StartupTimeout = TimeSpan.FromMinutes(5);

	private DistributedApplication? _app;

	public DistributedApplication App => _app ?? throw new InvalidOperationException("App has not been initialised — ensure InitializeAsync completed successfully.");

	public async Task InitializeAsync()
	{
		var appHost = await DistributedApplicationTestingBuilder
			.CreateAsync<Projects.YetAnotherFactoryPlanner_AppHost>(["--environment=Testing"]);

		_app = await appHost.BuildAsync();
		await _app.StartAsync();

		// The API project declares WaitFor(cosmosDb), so once the API resource is Running
		// we know the CosmosDB emulator is also ready.
		using var cts = new CancellationTokenSource(StartupTimeout);
		await _app.ResourceNotifications
			.WaitForResourceAsync("api", KnownResourceStates.Running, cts.Token);
	}

	public async Task DisposeAsync()
	{
		if (_app is not null)
			await _app.DisposeAsync();
	}

	/// <summary>
	/// Waits for the React client (Vite dev server) resource to reach Running state.
	/// Call this from Playwright test fixtures before navigating to the client.
	/// </summary>
	public async Task WaitForClientAsync(CancellationToken cancellationToken = default)
	{
		using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
		cts.CancelAfter(StartupTimeout);
		await App.ResourceNotifications
			.WaitForResourceAsync("client", KnownResourceStates.Running, cts.Token);
	}

	/// <summary>
	/// Returns the base URI of the React client resource.
	/// Call after <see cref="WaitForClientAsync"/> to ensure the resource is running.
	/// </summary>
	public Uri GetClientBaseUri()
	{
		using var client = App.CreateHttpClient("client");
		return client.BaseAddress!;
	}

	/// <summary>
	/// Returns the base URI of the API resource.
	/// </summary>
	public Uri GetApiBaseUri()
	{
		using var client = App.CreateHttpClient("api");
		return client.BaseAddress!;
	}
}

[CollectionDefinition(AppHostCollection.Name)]
public sealed class AppHostCollection : ICollectionFixture<AppHostFixture>
{
	public const string Name = "AppHost";
}
