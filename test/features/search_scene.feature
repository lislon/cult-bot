Feature: Search scene

  Background:
    Given now is 2020-01-01 12:00
    Given Scene is 'search_scene'
    Given there is events:
      | title   | category    | tag_level_1          | timetable    |
      | EventA  | exhibitions | #временныевыставки   | пн-вс: 15:00 |
      | EventB  | exhibitions | #постоянныеколлекции | пн-вс: 15:00 |

  Scenario: I can search by tag_level_1
    When I type 'временныевыставки'
    Then Bot responds '*Результаты*'
    Then Bot responds with slider with event 'EventA'

  Scenario: I can search by name
    When I type 'EventB'
    Then Bot responds '*Результаты*'
    Then Bot responds with slider with event 'EventB'
    Then Google analytics pageviews will be:
      | dp                           | dt                      |
      | /search/                     | Поиск                   |
      | /search/EventB/p1/?q=EventB  | Поиск по 'EventB' [1/1] |
