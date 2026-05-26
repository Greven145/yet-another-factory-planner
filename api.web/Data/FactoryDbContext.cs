using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.web.Data;

public class FactoryDbContext(DbContextOptions<FactoryDbContext> options) : DbContext(options)
{
    public DbSet<FactoryConfigSchema> Factories => Set<FactoryConfigSchema>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<FactoryConfigSchema>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.ToContainer("factories").HasPartitionKey(e => e.GameVersion);

            entity.Property(e => e.Id).ToJsonProperty("id");
            entity.Property(e => e.GameVersion).ToJsonProperty("gameVersion");
            entity.Property(e => e.AllowHandGatheredItems).ToJsonProperty("allowHandGatheredItems");

            // Primitive collection — stored as a JSON array of strings natively by the Cosmos provider
            entity.Property(e => e.AllowedRecipes).ToJsonProperty("allowedRecipes");

            // Complex type collections — stored as embedded JSON arrays by the Cosmos provider
            entity.OwnsMany(e => e.InputItems, owned => owned.ToJsonProperty("inputItems"));
            entity.OwnsMany(e => e.InputResources, owned => owned.ToJsonProperty("inputResources"));
            entity.OwnsMany(e => e.ProductionItems, owned => owned.ToJsonProperty("productionItems"));
            entity.OwnsMany(e => e.NodesPositions, owned => owned.ToJsonProperty("nodesPositions"));
            entity.OwnsOne(e => e.WeightingOptions, owned => owned.ToJsonProperty("weightingOptions"));
        });
    }
}
