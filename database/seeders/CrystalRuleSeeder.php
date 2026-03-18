<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

use Illuminate\Support\Facades\DB;
class CrystalRuleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('crystal_rules')->insert([
            ['min_level'=>1,'max_level'=>20,'plus0'=>1,'plus1'=>1,'plus2'=>1,'plus3'=>3],
            ['min_level'=>21,'max_level'=>29,'plus0'=>1,'plus1'=>2,'plus2'=>3,'plus3'=>6],
            ['min_level'=>30,'max_level'=>41,'plus0'=>1,'plus1'=>3,'plus2'=>4,'plus3'=>9],
            ['min_level'=>42,'max_level'=>49,'plus0'=>2,'plus1'=>4,'plus2'=>6,'plus3'=>12],
            ['min_level'=>50,'max_level'=>59,'plus0'=>4,'plus1'=>8,'plus2'=>12,'plus3'=>24],
            ['min_level'=>60,'max_level'=>69,'plus0'=>6,'plus1'=>12,'plus2'=>18,'plus3'=>36],
            ['min_level'=>70,'max_level'=>79,'plus0'=>7,'plus1'=>14,'plus2'=>21,'plus3'=>42],
            ['min_level'=>80,'max_level'=>90,'plus0'=>8,'plus1'=>16,'plus2'=>24,'plus3'=>48],
            ['min_level'=>90,'max_level'=>98,'plus0'=>9,'plus1'=>18,'plus2'=>27,'plus3'=>54],
            ['min_level'=>99,'max_level'=>119,'plus0'=>10,'plus1'=>20,'plus2'=>30,'plus3'=>60],
            ['min_level'=>120,'max_level'=>129,'plus0'=>11,'plus1'=>21,'plus2'=>31,'plus3'=>63],
            ['min_level'=>130,'max_level'=>999,'plus0'=>11,'plus1'=>22,'plus2'=>33,'plus3'=>66],
        ]);
    }
}
