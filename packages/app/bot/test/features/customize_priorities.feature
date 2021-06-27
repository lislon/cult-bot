Feature: Customize priorities

   январь 2020
   пн	вт	ср	чт	пт	сб	вс
            1	2	3	4	5
   6	7	8	9	10	11	12
   13	14	15	16	17	18	19
   20	21	22	23	24	25	26
   27	28	29	30	31

  Background:
    Given now is 2020-01-01 12:00
    Given Scene is 'customize_scene'

  Scenario: I can filter by last chance
    Given there is events:
      | title | category    | tag_level_1                    | timetable                   |
      | A     | exhibitions | #постоянныеколлекции #доммузей | 1 января - 10 января: 21:59 |
    When I click inline [Приоритеты]
    When I click inline [Последний шанс]
    Then Bot edits inline buttons:
      """
      [➕ С детьми ]
      [➕ Стоимость ]
      [Комфорт ]
      [Премьера ]
      [На воздухе ]
      [Компанией ]
      [Новые формы ]
      [Успеть за час ]
      [Последний шанс ✔]
      [Культурный базис ]
      [◀️ Назад] [🎯 1 найдено]
      """