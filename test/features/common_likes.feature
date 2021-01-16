Feature: Likes

  Background:
    Given now is 2020-01-01 12:00
    Given Scene is 'tops_scene'
    Given there is events:
      | title | category | timetable |
      | A     | theaters | вс: 15:00 |

  Scenario: Likes - I can toggle like event
    When I click markup [~tops_scene.theaters]
    Then Bot responds '*января*'
    Then Bot responds '*<b>A</b>*' with inline buttons:
      """
      [«] [👍 0] [👎 0] [⭐]
      [◀️ Назад] [1 / 1 »]
      """
    When I click inline [👍 0]
    Then Bot edits inline buttons:
      """
      [«] [👍 1] [👎 0] [⭐]
      [◀️ Назад] [1 / 1 »]
      """
    When I click inline [👍 1]
    Then Bot edits inline buttons:
      """
      [«] [👍 0] [👎 0] [⭐]
      [◀️ Назад] [1 / 1 »]
      """
    When I click inline [👎 0]
    Then Bot edits inline buttons:
      """
      [«] [👍 0] [👎 1] [⭐]
      [◀️ Назад] [1 / 1 »]
      """
    When I click inline [👍 0]
    Then Bot edits inline buttons:
      """
      [«] [👍 1] [👎 0] [⭐]
      [◀️ Назад] [1 / 1 »]
      """
