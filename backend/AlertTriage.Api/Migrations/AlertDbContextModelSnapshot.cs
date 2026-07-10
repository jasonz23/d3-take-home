using System;
using AlertTriage.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

#nullable disable

namespace AlertTriage.Api.Migrations;

[DbContext(typeof(AlertDbContext))]
partial class AlertDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
#pragma warning disable 612, 618
        modelBuilder
            .HasAnnotation("ProductVersion", "8.0.7")
            .HasAnnotation("Relational:MaxIdentifierLength", 63);

        modelBuilder.Entity("AlertTriage.Api.Models.Alert", b =>
        {
            b.Property<string>("Id")
                .HasColumnType("text");

            b.Property<string>("Assignee")
                .HasMaxLength(200)
                .HasColumnType("character varying(200)");

            b.Property<DateTimeOffset>("CreatedAt")
                .HasColumnType("timestamp with time zone");

            b.Property<string>("Severity")
                .IsRequired()
                .HasColumnType("text");

            b.Property<string>("Source")
                .IsRequired()
                .HasMaxLength(150)
                .HasColumnType("character varying(150)");

            b.Property<string>("Status")
                .IsRequired()
                .HasColumnType("text");

            b.Property<string>("Title")
                .IsRequired()
                .HasMaxLength(500)
                .HasColumnType("character varying(500)");

            b.Property<DateTimeOffset>("UpdatedAt")
                .HasColumnType("timestamp with time zone");

            b.Property<int>("Version")
                .IsConcurrencyToken()
                .HasColumnType("integer");

            b.HasKey("Id");

            b.HasIndex("CreatedAt");

            b.HasIndex("Severity");

            b.HasIndex("Source");

            b.HasIndex("Status");

            b.ToTable("Alerts");
        });

        modelBuilder.Entity("AlertTriage.Api.Models.AlertStatusEvent", b =>
        {
            b.Property<Guid>("Id")
                .ValueGeneratedOnAdd()
                .HasColumnType("uuid");

            b.Property<string>("AlertId")
                .IsRequired()
                .HasColumnType("text");

            b.Property<DateTimeOffset>("ChangedAt")
                .HasColumnType("timestamp with time zone");

            b.Property<string>("ChangedBy")
                .IsRequired()
                .HasMaxLength(200)
                .HasColumnType("character varying(200)");

            b.Property<string>("NewStatus")
                .IsRequired()
                .HasColumnType("text");

            b.Property<string>("PreviousStatus")
                .IsRequired()
                .HasColumnType("text");

            b.HasKey("Id");

            b.HasIndex("AlertId", "ChangedAt");

            b.ToTable("AlertStatusEvents");
        });

        modelBuilder.Entity("AlertTriage.Api.Models.AlertStatusEvent", b =>
        {
            b.HasOne("AlertTriage.Api.Models.Alert", "Alert")
                .WithMany("StatusEvents")
                .HasForeignKey("AlertId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();

            b.Navigation("Alert");
        });

        modelBuilder.Entity("AlertTriage.Api.Models.Alert", b =>
        {
            b.Navigation("StatusEvents");
        });
#pragma warning restore 612, 618
    }
}
