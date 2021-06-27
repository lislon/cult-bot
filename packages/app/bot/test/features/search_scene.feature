Feature: Search scene

  Background:
    Given now is 2020-01-01 12:00
    Given Scene is 'search_scene'
    Given there is events:
      | title       | category    | tag_level_1          | timetable             |
      | EventOld    | exhibitions | #временныевыставки   | 1 января 2020: 10:00  |
      | EventA      | exhibitions | #временныевыставки   | пн-вс: 15:00          |
      | EventB      | exhibitions | #постоянныеколлекции | пн-вс: 15:00          |
      | EventFuture | exhibitions | #временныевыставки   | 15 января 2020: 10:00 |

  Scenario: I can search by tag_level_1
    When I type 'временныевыставки'
    Then Bot responds '*Результаты*'
    Then Bot responds with slider with event 'EventA'

  Scenario: I can exit search
    When I click markup ['⏮ В главное меню']
    Then I will be on scene 'main_scene'

  Scenario: I can search by name
    When I type 'EventB'
    Then Bot responds '*Результаты*'
    Then Bot responds with slider with event 'EventB'
    Then Google analytics pageviews will be:
      | dp                          | dt                      |
      | /search/                    | Поиск                   |
      | /search/EventB/p1/?q=EventB | Поиск по 'EventB' [1/1] |

  Scenario: I can see all events in future
    When I type 'временныевыставки'
    Then Bot responds something
    Then Bot responds with slider with event 'EventA'
    When I click slider next
    Then Bot edits slider with event 'EventFuture' [2/2]
