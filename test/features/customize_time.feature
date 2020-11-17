Feature: Customize time
  I can select time when I want to see events

   январь 2020
   пн	вт	ср	чт	пт	сб	вс
            1	2	3	4	5
   6	7	8	9	10	11	12
   13	14	15	16	17	18	19
   20	21	22	23	24	25	26
   27	28	29	30	31

  Scenario: I can see number of events when click on time
    When I enter 'customize' scene
    Then Bot responds 'Настройте фильтры по Вашим предпочтениям' with markup buttons:
      """
      [🔣 Области] [💟 Приоритеты]
      [#️⃣ Время] [🏠 Формат]
      [📜 Показать события]
      [◀️ Назад]
      """

  Scenario:  I want select to events by time on friday
    Given now is 2020-01-03 12:00
    When I enter 'customize' scene
    When I click markup [🕒 Время]
    Then Bot responds 'Здесь можно настроить временные интервалы, в которых искать события' with inline buttons:
      """
      [➕ Суббота (04.01) ]
      [➕ Воскресенье (05.01) ]
      """

  Scenario: I want select to events by time on sunday
    Given now is 2020-01-05 00:00
    When I enter 'customize' scene
    When I click markup [🕒 Время]
    Then Bot responds 'Здесь можно настроить временные интервалы, в которых искать события' with inline buttons:
      """
      [➕ Воскресенье (05.01) ]
      """
    When I click inline [➕ Воскресенье (05.01)]
    Then Bot edits inline buttons:
      """
      [➖ Воскресенье (05.01) ]
      [🌃 00:00-06:00 ]
      [🌅 06:00-12:00 ]
      [🏞 12:00-15:00 ]
      [🌇 15:00-19:00 ]
      [🏙 19:00-22:00 ]
      [🌃 22:00-24:00 ]
      """
    When I click inline [🌃 22:00-24:00]
    Then Bot edits inline buttons:
      """
      [➖ Воскресенье (05.01) ✔]
      [🌃 00:00-06:00 ]
      [🌅 06:00-12:00 ]
      [🏞 12:00-15:00 ]
      [🌇 15:00-19:00 ]
      [🏙 19:00-22:00 ]
      [🌃 22:00-24:00 ✔]
      """
    When I click markup [◀ Назад]
    Then Bot responds:
    """
    Вы выбрали фильтр:

    #️⃣ <b>Время</b>:  ВС (05.01): 22.00-24.00

    <b>0 событий</b> найдено
    """

  Scenario: When I selected filter saturday 22-24, then some time passed and today is sunday, these selections should gone
    Given now is 2020-01-04 12:00
    * I enter 'customize' scene
    * I click markup [#️⃣ Время]
    * I click inline [➕ Суббота (04.01)]
    * I click inline [🌃 22:00-24:00]
    * now is 2020-01-05 12:00
    * I click markup [◀ Назад]
    Then Bot responds 'Настройте фильтры по Вашим предпочтениям'

  Scenario: I don't want to see buttons with time in past
    Given now is 2020-01-05 21:50
    When I enter 'customize' scene
    * I click markup [🕒 Время]
    * I click inline [➕ Воскресенье (05.01)]
    Then Bot edits inline buttons:
      """
      [➖ Воскресенье (05.01) ]
      [🏙 19:00-22:00 ]
      [🌃 22:00-24:00 ]
      """

  Scenario: I selected time slot, but it passed
    Given now is 2020-01-05 10:00
    When I enter 'customize' scene
    * I click markup [#️⃣ Время]
    * I click inline [➕ Воскресенье (05.01)]
    * I click inline [🌅 06:00-12:00]
    * I click inline [🏞 12:00-15:00]
    * now is 2020-01-05 13:00
    * I click markup [◀ Назад]
    Then Bot responds:
      """
      Вы выбрали фильтр:

      #️⃣ <b>Время</b>:  ВС (05.01): 12.00-15.00

      <b>0 событий</b> найдено
    """
