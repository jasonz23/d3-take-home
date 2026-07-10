using AlertTriage.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AlertTriage.Api.Data;

public sealed class AlertDbContext : DbContext
{
    public AlertDbContext(DbContextOptions<AlertDbContext> options)
        : base(options)
    {
    }

    public DbSet<Alert> Alerts => Set<Alert>();
    public DbSet<AlertStatusEvent> AlertStatusEvents => Set<AlertStatusEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Alert>(entity =>
        {
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Title)
                .HasMaxLength(500)
                .IsRequired();

            entity.Property(x => x.Source)
                .HasMaxLength(150)
                .IsRequired();

            entity.Property(x => x.Assignee)
                .HasMaxLength(200);

            entity.Property(x => x.Severity)
                .HasConversion<string>();

            entity.Property(x => x.Status)
                .HasConversion<string>();

            entity.Property(x => x.Version)
                .IsConcurrencyToken();

            entity.HasIndex(x => x.Status);
            entity.HasIndex(x => x.Severity);
            entity.HasIndex(x => x.Source);
            entity.HasIndex(x => x.CreatedAt);
        });

        modelBuilder.Entity<AlertStatusEvent>(entity =>
        {
            entity.HasKey(x => x.Id);

            entity.Property(x => x.PreviousStatus)
                .HasConversion<string>();

            entity.Property(x => x.NewStatus)
                .HasConversion<string>();

            entity.Property(x => x.ChangedBy)
                .HasMaxLength(200)
                .IsRequired();

            entity.HasOne(x => x.Alert)
                .WithMany(x => x.StatusEvents)
                .HasForeignKey(x => x.AlertId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => new { x.AlertId, x.ChangedAt });
        });
    }
}
