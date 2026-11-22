<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\User;

/** Each user's old/new screen design choice is saved on their account (look only). */
class UiDesignPreferenceTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_save_design_choice_and_me_returns_it()
    {
        $user = User::factory()->create();

        $this->actingAs($user)->getJson('/api/me')->assertOk()->assertJsonPath('ui_design', null);

        $this->actingAs($user)->putJson('/api/me/ui-design', ['ui_design' => 'new'])
            ->assertOk()->assertJsonPath('ui_design', 'new');
        $this->assertSame('new', $user->fresh()->ui_design);
        $this->actingAs($user)->getJson('/api/me')->assertJsonPath('ui_design', 'new');

        $this->actingAs($user)->putJson('/api/me/ui-design', ['ui_design' => 'old'])->assertOk();
        $this->assertSame('old', $user->fresh()->ui_design);
    }

    public function test_only_old_or_new_is_accepted()
    {
        $user = User::factory()->create();
        $this->actingAs($user)->putJson('/api/me/ui-design', ['ui_design' => 'purple'])->assertStatus(422);
        $this->actingAs($user)->putJson('/api/me/ui-design', [])->assertStatus(422);
        $this->assertNull($user->fresh()->ui_design);
    }

    public function test_saving_design_only_changes_that_user()
    {
        $a = User::factory()->create();
        $b = User::factory()->create();
        $this->actingAs($a)->putJson('/api/me/ui-design', ['ui_design' => 'new'])->assertOk();
        $this->assertSame('new', $a->fresh()->ui_design);
        $this->assertNull($b->fresh()->ui_design);
    }

    public function test_guest_cannot_save_design_choice()
    {
        $this->putJson('/api/me/ui-design', ['ui_design' => 'new'])->assertStatus(401);
    }
}
