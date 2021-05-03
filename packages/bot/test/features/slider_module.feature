Feature: Slider

  Background:
    Given now is 2020-01-05 12:00
    Given Scene is 'tops_scene'
    Given bot config SLIDER_MAX_IDS_CACHED=2
    Given there is events:
      | title | category | timetable | rating |
      | A     | theaters | вс: 15:00 | 5      |
      | B     | theaters | вс: 16:00 | 4      |
      | C     | theaters | вс: 17:00 | 3      |
      | D     | theaters | вс: 18:00 | 2      |
    When I click markup [~tops_scene.theaters]
    Then Bot responds something
    Then Bot responds with slider with event 'A'

  Scenario: Some events are expired during page
    Given now is 2020-01-05 16:30
    # A,B is cached
    When I click slider next
    Then Bot edits slider with event 'B' [2/4]
    When I click slider next
    Then Bot edits slider with event 'C' [1/2]
    Then Bot edits text '*перепрыгнул*'
    When I click slider next
    Then Bot edits slider with event 'D' [2/2]

  Scenario: All are expired during page
    Given now is 2020-01-05 19:30
    When I click slider next
    Then Bot edits slider with event 'B' [2/4]
    When I click slider next
    Then Bot edits text '*Не осталось событий в этой подборке*'


  Scenario: Can click next like crazy
    When I click slider next
    Then Bot edits slider with event 'B'
    When I click slider next
    Then Bot edits slider with event 'C'
    When I click slider next
    Then Bot edits slider with event 'D'
    When I click slider next
    Then Bot edits slider with event 'A'

  Scenario: I can toggle between extended and small card
    When I click slider next