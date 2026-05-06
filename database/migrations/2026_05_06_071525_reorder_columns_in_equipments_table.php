<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            ALTER TABLE equipments
            MODIFY COLUMN item_id varchar(255) NOT NULL AFTER id,
            MODIFY COLUMN item_name varchar(255) NOT NULL AFTER item_id,
            MODIFY COLUMN item_name_en varchar(255) NULL AFTER item_name,

            MODIFY COLUMN group_id varchar(255) NULL AFTER item_name_en,
            MODIFY COLUMN group_name varchar(255) NULL AFTER group_id,
            MODIFY COLUMN group_kind varchar(255) NULL AFTER group_name,

            MODIFY COLUMN equipment_type_id bigint unsigned NULL AFTER group_kind,

            MODIFY COLUMN effects_json json NULL AFTER equipment_type_id,

            MODIFY COLUMN max_hp int unsigned NULL AFTER effects_json,
            MODIFY COLUMN max_mp int unsigned NULL AFTER max_hp,
            MODIFY COLUMN attack int unsigned NULL AFTER max_mp,
            MODIFY COLUMN defense int unsigned NULL AFTER attack,
            MODIFY COLUMN charm int unsigned NULL AFTER defense,
            MODIFY COLUMN agility int unsigned NULL AFTER charm,
            MODIFY COLUMN dexterity int unsigned NULL AFTER agility,
            MODIFY COLUMN magic_attack int unsigned NULL AFTER dexterity,
            MODIFY COLUMN healing_power int unsigned NULL AFTER magic_attack,

            MODIFY COLUMN job_override_mode enum('inherit','add','replace') NOT NULL DEFAULT 'inherit' AFTER healing_power,
            MODIFY COLUMN craft_level int unsigned NULL AFTER job_override_mode,
            MODIFY COLUMN equip_level int unsigned NULL AFTER craft_level,
            MODIFY COLUMN recipe_book varchar(255) NULL AFTER equip_level,
            MODIFY COLUMN recipe_place varchar(255) NULL AFTER recipe_book,
            MODIFY COLUMN description text NULL AFTER recipe_place,
            MODIFY COLUMN slot varchar(255) NULL AFTER description,
            MODIFY COLUMN slot_grid_type varchar(255) NULL AFTER slot,
            MODIFY COLUMN slot_grid_cols int unsigned NULL AFTER slot_grid_type,
            MODIFY COLUMN materials_json json NULL AFTER slot_grid_cols,
            MODIFY COLUMN slot_grid_json json NULL AFTER materials_json,
            MODIFY COLUMN source_url varchar(255) NULL AFTER slot_grid_json,
            MODIFY COLUMN detail_url varchar(255) NULL AFTER source_url,
            MODIFY COLUMN default_price int unsigned NULL AFTER detail_url,
            MODIFY COLUMN weight int unsigned NULL AFTER default_price,
            MODIFY COLUMN created_at timestamp NULL AFTER weight,
            MODIFY COLUMN updated_at timestamp NULL AFTER created_at
        ");
    }

    public function down(): void
    {
        DB::statement("
            ALTER TABLE equipments
            MODIFY COLUMN attack int unsigned NULL AFTER id,
            MODIFY COLUMN defense int unsigned NULL AFTER attack,
            MODIFY COLUMN max_hp int unsigned NULL AFTER defense,
            MODIFY COLUMN max_mp int unsigned NULL AFTER max_hp,
            MODIFY COLUMN charm int unsigned NULL AFTER max_mp,
            MODIFY COLUMN agility int unsigned NULL AFTER charm,
            MODIFY COLUMN dexterity int unsigned NULL AFTER agility,
            MODIFY COLUMN magic_attack int unsigned NULL AFTER dexterity,
            MODIFY COLUMN healing_power int unsigned NULL AFTER magic_attack,

            MODIFY COLUMN item_id varchar(255) NOT NULL AFTER healing_power,
            MODIFY COLUMN item_name varchar(255) NOT NULL AFTER item_id,
            MODIFY COLUMN item_name_en varchar(255) NULL AFTER item_name,
            MODIFY COLUMN equipment_type_id bigint unsigned NULL AFTER item_name_en,
            MODIFY COLUMN job_override_mode enum('inherit','add','replace') NOT NULL DEFAULT 'inherit' AFTER equipment_type_id,
            MODIFY COLUMN craft_level int unsigned NULL AFTER job_override_mode,
            MODIFY COLUMN equip_level int unsigned NULL AFTER craft_level,
            MODIFY COLUMN recipe_book varchar(255) NULL AFTER equip_level,
            MODIFY COLUMN recipe_place varchar(255) NULL AFTER recipe_book,
            MODIFY COLUMN description text NULL AFTER recipe_place,
            MODIFY COLUMN slot varchar(255) NULL AFTER description,
            MODIFY COLUMN slot_grid_type varchar(255) NULL AFTER slot,
            MODIFY COLUMN slot_grid_cols int unsigned NULL AFTER slot_grid_type,
            MODIFY COLUMN group_kind varchar(255) NULL AFTER slot_grid_cols,
            MODIFY COLUMN group_id varchar(255) NULL AFTER group_kind,
            MODIFY COLUMN group_name varchar(255) NULL AFTER group_id,
            MODIFY COLUMN materials_json json NULL AFTER group_name,
            MODIFY COLUMN slot_grid_json json NULL AFTER materials_json,
            MODIFY COLUMN source_url varchar(255) NULL AFTER slot_grid_json,
            MODIFY COLUMN detail_url varchar(255) NULL AFTER source_url,
            MODIFY COLUMN effects_json json NULL AFTER detail_url,
            MODIFY COLUMN default_price int unsigned NULL AFTER effects_json,
            MODIFY COLUMN weight int unsigned NULL AFTER default_price,
            MODIFY COLUMN created_at timestamp NULL AFTER weight,
            MODIFY COLUMN updated_at timestamp NULL AFTER created_at
        ");
    }
};