Feature: Customize navigation
  Test paging and entering/exiting menus

  январь 2020
  пн	вт	ср	чт	пт	сб	вс
  1	2	3	4	5
  6	7	8	9	10	11	12
  13	14	15	16	17	18	19
  20	21	22	23	24	25	26
  27	28	29	30	31

  Background:
    Given now is 2020-01-01 12:00
    Given Scene is 'tops_scene'

  Scenario: I can go back and forward when single event exists
    Given there is events:
      | title | category | timetable | rating |
      | A     | theaters | вс: 14:00 | 20     |
      | B     | theaters | вс: 15:00 | 5      |
    When I click markup [~tops_scene.theaters]
    Then Bot responds something
    Then Bot responds '*<b>A</b>*' with inline buttons:
      """
      [◀️] [👍] [👎] [⭐]
      [«] [#] [1 / 2 »]
      """
    When I click inline [«]
    Then Bot edits inline buttons:
      """
      [◀️] [👍] [👎] [⭐]
      [«] [#] [2 / 2 »]
      """
    When I click inline [2 / 2 »]
    Then Bot edits inline buttons:
      """
      [◀️] [👍] [👎] [⭐]
      [«] [#] [1 / 2 »]
      """
